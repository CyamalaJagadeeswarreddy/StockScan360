document.addEventListener('DOMContentLoaded', () => {
    let html5QrcodeScanner = null;
    let isScanning = false;
    let editingIndex = null;
    let inventoryChart = null; 
    const inventory = JSON.parse(localStorage.getItem('stockScan360Inventory')) || [];
    const elements = {
        startScanBtn: document.getElementById('start-scan-btn'),
        stopScanBtn: document.getElementById('stop-scan-btn'),
        scanResult: document.getElementById('scan-result'),
        itemForm: document.getElementById('item-form'),
        submitBtn: document.getElementById('save-btn'),
        barcodeInput: document.getElementById('barcode'),
        inventoryBody: document.getElementById('inventory-body'),
        searchInput: document.getElementById('search-input'),
        clearDataBtn: document.getElementById('clear-data-btn'),
        emptyMessage: document.getElementById('empty-message'),
        exportBtn: document.getElementById('export-btn'),
        importBtn: document.getElementById('import-btn'),
        importFile: document.getElementById('import-file')
    };

   
    const toggleBtn = document.getElementById('theme-toggle');
    const body = document.body;

    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        toggleBtn.textContent = '☀️';
    }

    toggleBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            toggleBtn.textContent = '☀️';
        } else {
            localStorage.setItem('theme', 'light');
            toggleBtn.textContent = '🌙';
        }
    });

    
    renderInventory();

    
    elements.startScanBtn.addEventListener('click', startScanning);
    elements.stopScanBtn.addEventListener('click', stopScanning);
    elements.itemForm.addEventListener('submit', handleFormSubmit);
    elements.searchInput.addEventListener('input', filterInventory);
    elements.clearDataBtn.addEventListener('click', clearAllData);
    elements.exportBtn.addEventListener('click', exportToCSV);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importFromCSV);

    
    function startScanning() {
        if (isScanning) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support camera access.');
            return;
        }
        html5QrcodeScanner = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess,
            onScanFailure
        ).then(() => {
            isScanning = true;
            elements.startScanBtn.disabled = true;
            elements.stopScanBtn.disabled = false;
            elements.scanResult.style.display = 'none';
        }).catch(err => {
            console.error("Error starting camera:", err);
            alert("Error starting camera: " + err);
        });
    }

    function stopScanning() {
        if (!isScanning || !html5QrcodeScanner) return;
        html5QrcodeScanner.stop().then(() => {
            isScanning = false;
            elements.startScanBtn.disabled = false;
            elements.stopScanBtn.disabled = true;
            html5QrcodeScanner.clear();
        }).catch(err => { console.error("Failed to stop scan:", err); });
    }

    function onScanSuccess(decodedText, decodedResult) {
        elements.scanResult.textContent = `Scanned: ${decodedText}`;
        elements.scanResult.style.display = 'block';
        elements.barcodeInput.value = decodedText;
        if (html5QrcodeScanner) {
            html5QrcodeScanner.pause();
            setTimeout(() => { html5QrcodeScanner.resume(); }, 2000);
        }
    }

    function onScanFailure(error) {
        
    }

    
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            barcode: elements.barcodeInput.value.trim(),
            name: document.getElementById('name').value.trim(),
            quantity: parseInt(document.getElementById('quantity').value),
            category: document.getElementById('category').value,
            price: parseFloat(document.getElementById('price').value),
            reorder: parseInt(document.getElementById('reorder').value)
        };

        if (editingIndex !== null) {
           
            inventory[editingIndex] = formData;
            editingIndex = null; 
            elements.submitBtn.textContent = "Save to Inventory";
            elements.submitBtn.classList.remove('btn-warning');
            elements.submitBtn.classList.add('btn-success');
            alert('Item Updated Successfully!');
        } else {
            
            const existingItemIndex = inventory.findIndex(item => item.barcode === formData.barcode);
            if (existingItemIndex > -1) {
                if (confirm(`Barcode ${formData.barcode} exists. Update quantity?`)) {
                    inventory[existingItemIndex].quantity += formData.quantity;
                    inventory[existingItemIndex].name = formData.name;
                    inventory[existingItemIndex].price = formData.price;
                    inventory[existingItemIndex].reorder = formData.reorder;
                } else { return; }
            } else {
                inventory.push(formData);
                alert('Item Added Successfully!');
            }
        }

        saveInventory();
        renderInventory();
        elements.itemForm.reset();
        elements.barcodeInput.value = formData.barcode; 
    }

    
    function renderInventory(itemsToRender = inventory) {
        elements.inventoryBody.innerHTML = '';
        
        if (itemsToRender.length === 0) {
            elements.emptyMessage.style.display = 'block';
        } else {
            elements.emptyMessage.style.display = 'none';
        }

        itemsToRender.forEach((item, index) => {
            const row = document.createElement('tr');
            
            
            if (item.quantity <= item.reorder) {
                row.classList.add('low-stock');
            }
            
            
            const barcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            JsBarcode(barcodeSvg, item.barcode, { format: "CODE128", width: 2, height: 40, displayValue: true });
            barcodeSvg.classList.add('barcode-svg');

            
            row.innerHTML = `
                <td><input type="checkbox" class="print-check"></td>
                <td>${item.barcode}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td></td>
                <td>
                    <button class="edit-btn" data-barcode="${item.barcode}">Edit</button>
                    <button class="delete-btn" data-barcode="${item.barcode}">Delete</button>
                </td>
            `;
            
            row.querySelector('td:nth-child(6)').appendChild(barcodeSvg);
            elements.inventoryBody.appendChild(row);
        });

        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() { 
                const barcode = this.getAttribute('data-barcode');
                loadItemForEdit(barcode); 
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() { deleteItem(this.getAttribute('data-barcode')); });
        });

        
        updateAnalytics();
    }

    
    function updateAnalytics() {
        const totalValue = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        document.getElementById('total-value').innerText = `$${totalValue.toFixed(2)}`;

        const categories = {};
        inventory.forEach(item => {
            categories[item.category] = (categories[item.category] || 0) + item.quantity;
        });

        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        if (inventoryChart) {
            inventoryChart.destroy();
        }

        inventoryChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    label: 'Items per Category',
                    data: Object.values(categories),
                    backgroundColor: ['#36a2eb', '#ff6384', '#ffcd56', '#4bc0c0', '#9966ff', '#ff9f40']
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }

    
    function loadItemForEdit(barcode) {
        const item = inventory.find(i => i.barcode === barcode);
        
        if (!item) return;

        elements.barcodeInput.value = item.barcode;
        document.getElementById('name').value = item.name;
        document.getElementById('quantity').value = item.quantity;
        document.getElementById('category').value = item.category;
        document.getElementById('price').value = item.price;
        document.getElementById('reorder').value = item.reorder;

        editingIndex = inventory.findIndex(i => i.barcode === barcode);
        
        elements.submitBtn.textContent = "Update Item";
        elements.submitBtn.classList.remove('btn-success');
        elements.submitBtn.classList.add('btn-warning');
        
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }

    
    function exportToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Barcode,Name,Category,Quantity,Price\n";

        inventory.forEach(item => {
            const row = `"${item.barcode}","${item.name}","${item.category}",${item.quantity},${item.price}`;
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "stockscan360_inventory.csv");
        document.body.appendChild(link); 
        link.click();
        document.body.removeChild(link);
    }

   
    function importFromCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split('\n');
            let successCount = 0;

            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                
                const parts = line.split(',');
                if (parts.length >= 5) {
                    const barcode = parts[0].replace(/"/g, '').trim();
                    const name = parts[1].replace(/"/g, '').trim();
                    const category = parts[2].replace(/"/g, '').trim();
                    const quantity = parseInt(parts[3]);
                    const price = parseFloat(parts[4]);

                    const existingIndex = inventory.findIndex(item => item.barcode === barcode);
                    
                    if (existingIndex > -1) {
                        inventory[existingIndex] = { ...inventory[existingIndex], name, category, quantity, price };
                    } else {
                        inventory.push({ barcode, name, category, quantity, price, reorder: 5 });
                    }
                    successCount++;
                }
            }

            saveInventory();
            renderInventory();
            alert(`Successfully imported ${successCount} items!`);
            
            // Clear input
            event.target.value = '';
        };

        reader.readAsText(file);
    }

    
    function printSelectedLabels() {
        const checkboxes = document.querySelectorAll('.print-check:checked');
        
        if (checkboxes.length === 0) {
            alert("Please select at least one item to print.");
            return;
        }

        const allRows = document.querySelectorAll('#inventory-body tr');
        allRows.forEach(row => {
            const checkbox = row.querySelector('.print-check');
            if (checkbox && !checkbox.checked) {
                row.style.display = 'none';
            } else {
                row.style.display = '';
            }
        });

        window.print();

        setTimeout(() => {
            allRows.forEach(row => row.style.display = '');
        }, 1000);
    }

    
    function filterInventory() {
        const term = elements.searchInput.value.toLowerCase();
        const filtered = inventory.filter(item => 
            item.name.toLowerCase().includes(term) || 
            item.barcode.toLowerCase().includes(term)
        );
        renderInventory(filtered);
    }

    function deleteItem(barcode) {
        if (confirm('Delete this item?')) {
            const index = inventory.findIndex(item => item.barcode === barcode);
            if (index > -1) {
                inventory.splice(index, 1);
                saveInventory();
                renderInventory();
            }
        }
    }

    function clearAllData() {
        if (confirm('Delete ALL inventory data?')) {
            inventory.length = 0;
            saveInventory();
            renderInventory();
        }
    }

    function saveInventory() {
        localStorage.setItem('stockScan360Inventory', JSON.stringify(inventory));
    }
});
