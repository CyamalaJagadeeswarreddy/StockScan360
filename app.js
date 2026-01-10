document.addEventListener('DOMContentLoaded', () => {
    let html5QrcodeScanner = null;
    let isScanning = false;
    let editingIndex = null;
    let inventoryChart = null; // To store the chart instance

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
        emptyMessage: document.getElementById('empty-message')
    };

    renderInventory();

    elements.startScanBtn.addEventListener('click', startScanning);
    elements.stopScanBtn.addEventListener('click', stopScanning);
    elements.itemForm.addEventListener('submit', handleFormSubmit);
    elements.searchInput.addEventListener('input', filterInventory);
    elements.clearDataBtn.addEventListener('click', clearAllData);

    // --- SCANNING FUNCTIONS ---
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
        // console.warn(`Scan error: ${error}`);
    }

    // --- FORM HANDLING (CREATE & UPDATE) ---
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            barcode: elements.barcodeInput.value.trim(),
            name: document.getElementById('name').value.trim(),
            quantity: parseInt(document.getElementById('quantity').value),
            category: document.getElementById('category').value,
            price: parseFloat(document.getElementById('price').value)
        };

        if (editingIndex !== null) {
            // UPDATE MODE
            inventory[editingIndex] = formData;
            editingIndex = null; // Reset edit mode
            elements.submitBtn.textContent = "Save to Inventory";
            elements.submitBtn.classList.remove('btn-warning');
            elements.submitBtn.classList.add('btn-success');
            alert('Item Updated Successfully!');
        } else {
            // CREATE MODE
            const existingItemIndex = inventory.findIndex(item => item.barcode === formData.barcode);
            if (existingItemIndex > -1) {
                if (confirm(`Barcode ${formData.barcode} exists. Update quantity?`)) {
                    inventory[existingItemIndex].quantity += formData.quantity;
                    inventory[existingItemIndex].name = formData.name;
                    inventory[existingItemIndex].price = formData.price;
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

    // --- RENDERING & ANALYTICS ---
    function renderInventory(itemsToRender = inventory) {
        elements.inventoryBody.innerHTML = '';
        
        if (itemsToRender.length === 0) {
            elements.emptyMessage.style.display = 'block';
        } else {
            elements.emptyMessage.style.display = 'none';
        }

        itemsToRender.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Generate Barcode SVG
            const barcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            JsBarcode(barcodeSvg, item.barcode, { format: "CODE128", width: 2, height: 40, displayValue: true });
            barcodeSvg.classList.add('barcode-svg');

            // Create Row with Edit & Delete Buttons
            row.innerHTML = `
                <td>${item.barcode}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td></td>
                <td>
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="delete-btn" data-barcode="${item.barcode}">Delete</button>
                </td>
            `;
            
            row.querySelector('td:nth-child(6)').appendChild(barcodeSvg);
            elements.inventoryBody.appendChild(row);
        });

        // Attach Events to Buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() { loadItemForEdit(parseInt(this.getAttribute('data-index'))); });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() { deleteItem(this.getAttribute('data-barcode')); });
        });

        // ADDED: Update Analytics Dashboard
        updateAnalytics();
    }

    // --- ANALYTICS LOGIC ---
    function updateAnalytics() {
        // 1. Calculate Total Value
        const totalValue = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        document.getElementById('total-value').innerText = `$${totalValue.toFixed(2)}`;

        // 2. Prepare Data for Chart
        const categories = {};
        inventory.forEach(item => {
            categories[item.category] = (categories[item.category] || 0) + item.quantity;
        });

        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        // Destroy old chart if it exists to prevent overlap
        if (inventoryChart) {
            inventoryChart.destroy();
        }

        // 3. Create New Chart
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

    // --- EDIT FUNCTION ---
    function loadItemForEdit(index) {
        const item = inventory[index];
        elements.barcodeInput.value = item.barcode;
        document.getElementById('name').value = item.name;
        document.getElementById('quantity').value = item.quantity;
        document.getElementById('category').value = item.category;
        document.getElementById('price').value = item.price;

        editingIndex = index; // Set global edit mode
        
        // Visual Feedback
        elements.submitBtn.textContent = "Update Item";
        elements.submitBtn.classList.remove('btn-success');
        elements.submitBtn.classList.add('btn-warning');
        
        // Scroll to form
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }

    // --- HELPER FUNCTIONS ---
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