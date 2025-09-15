    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const imagePreview = document.getElementById('imagePreview');
    const tableWrap = document.getElementById('tableWrap');
    const filenameEl = document.getElementById('filename');
    const statusMsg = document.getElementById('statusMsg');
    const toast = document.getElementById('toast');
    const detectTableCheckbox = document.getElementById('detectTable');

    let currentFile = null;
    let tableData = []; // This will now store the data for rendering and editing

    // --- UI Interactions (Unchanged) ---
    function showToast(message, isError = false) {
      toast.textContent = message;
      toast.className = `toast fixed right-5 bottom-5 py-3 px-4 rounded-lg ${isError ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`;
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 3000);
    }

    function setLoading(isLoading) {
      const convertText = convertBtn.querySelector('.btn-text');
      const convertSpinner = convertBtn.querySelector('.spinner');
      if (isLoading) {
        convertText.classList.add('hidden');
        convertSpinner.classList.remove('hidden');
        convertBtn.disabled = true;
        statusMsg.textContent = 'Converting...';
      } else {
        convertText.classList.remove('hidden');
        convertSpinner.classList.add('hidden');
        convertBtn.disabled = false;
        statusMsg.textContent = 'Ready';
      }
    }

    function handleFileSelect(file) {
      if (!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPG, PNG).', true);
        return;
      }
      currentFile = file;
      filenameEl.textContent = file.name;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.innerHTML = `<img src="${e.target.result}" class="max-w-full max-h-[420px] object-contain" alt="Image preview"/>`;
      };
      reader.readAsDataURL(file);
      
      tableWrap.innerHTML = '<div class="text-gray-400 text-sm">Ready to convert.</div>';
      downloadBtn.classList.add('hidden');
    }
    
    function clearAll() {
        currentFile = null;
        fileInput.value = '';
        filenameEl.textContent = 'No file selected';
        imagePreview.innerHTML = '<div class="text-gray-400">No image uploaded</div>';
        tableWrap.innerHTML = '<div class="text-gray-400 text-sm">No preview yet</div>';
        downloadBtn.classList.add('hidden');
        statusMsg.textContent = 'Idle';
        tableData = [];
    }

    // --- Event Listeners (Unchanged) ---
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('hover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('hover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('hover');
      if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    clearBtn.addEventListener('click', clearAll);
    convertBtn.addEventListener('click', () => {
        if (!currentFile) {
            showToast('Please select an image first!', true);
            return;
        }
        convertImageToTable();
    });
    downloadBtn.addEventListener('click', downloadExcel);

    // --- Core Logic: Call Backend and Generate Table ---
    async function convertImageToTable() {
      setLoading(true);

      // Use FormData to send the file and options to the backend
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('detectTable', detectTableCheckbox.checked);

      try {
        const response = await fetch('https://jpg-2-excel.onrender.com/api/convert', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            // Use the error message from the backend if available
            throw new Error(result.error || `Server responded with status: ${response.status}`);
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(result.data);
        } catch (e) {
            console.error("Failed to parse JSON response from backend:", result.data);
            throw new Error("Could not parse the data from the image. The format was unexpected.");
        }

        const detectTable = detectTableCheckbox.checked;

        if (detectTable) {
            if (Array.isArray(parsedJson) && parsedJson.every(row => Array.isArray(row))) {
              tableData = parsedJson;
            } else {
              throw new Error("Expected a JSON array of arrays for the table data.");
            }
        } else {
            if (Array.isArray(parsedJson) && parsedJson.every(item => typeof item === 'string')) {
              tableData = parsedJson.map(line => [line]); // Convert to array of arrays for consistency
            } else {
              throw new Error("Expected a JSON array of strings for the text data.");
            }
        }

        renderTable(tableData);
        downloadBtn.classList.remove('hidden');
        showToast('Conversion successful!');
        statusMsg.textContent = "Preview Ready";

      } catch (error) {
        console.error("Conversion Error:", error);
        showToast(`Try Again: ${error.message}`, true);
        tableWrap.innerHTML = `<div class="text-red-400 p-4">Please add a clear image or try again.</div>`;
        statusMsg.textContent = "Error";
      } finally {
        setLoading(false);
      }
    }

    // --- Render Table Logic (Updated for clarity) ---
    function renderTable(data) {
        if (!data || data.length === 0) {
            tableWrap.innerHTML = '<div class="text-gray-400 text-sm">No table data extracted.</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'preview w-full border-collapse text-sm';
        const detectTable = detectTableCheckbox.checked;

        // Create Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = detectTable ? data[0] : ["Extracted Text"];
        
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.className = "p-2 text-left";
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create Body
        const tbody = document.createElement('tbody');
        const dataRows = detectTable ? data.slice(1) : data;

        dataRows.forEach((rowData) => {
            const tr = document.createElement('tr');
            rowData.forEach((cellData) => {
                const td = document.createElement('td');
                td.className = "p-2";
                td.textContent = cellData;
                td.contentEditable = true;
                // No need for event listener here, we'll read from the DOM on download
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableWrap.innerHTML = '';
        tableWrap.appendChild(table);
    }
    
    // --- Excel Export (Updated to read directly from the rendered table) ---
    function downloadExcel() {
        const table = tableWrap.querySelector('table');
        if (!table) {
            showToast("No data to download.", true);
            return;
        }
        
        const filename = currentFile ? `${currentFile.name.split('.')[0]}.xlsx` : "converted_data.xlsx";

        // Use the XLSX utility to directly convert the HTML table element to a workbook
        const workbook = XLSX.utils.table_to_book(table, {sheet: "Sheet1"});
        XLSX.writeFile(workbook, filename);
        
        showToast("Excel file downloaded!");

    }


