// --- Theme Handling --- //

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
    document.getElementById('themeIcon').textContent = '☀️';
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        document.documentElement.classList.add('dark');
        document.getElementById('themeIcon').textContent = '☀️';
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('themeIcon').textContent = '🌙';
    }
});
document.getElementById('toggleTheme').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
});

// --- Caesar Cipher --- //
function caesarEncrypt(text, shift) {
    return text.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            return String.fromCharCode(((code - 65 + shift) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
            return String.fromCharCode(((code - 97 + shift) % 26) + 97);
        }
        return char;
    }).join('');
}
function caesarDecrypt(text, shift) {
    return caesarEncrypt(text, 26 - (shift % 26));
}

// --- Stream Cipher (XOR with base64) --- //
function streamCipherEncrypt(text, key) {
    let result = [];
    for (let i = 0; i < text.length; i++) {
        let keyChar = key.charCodeAt(i % key.length);
        result.push(text.charCodeAt(i) ^ keyChar);
    }
    return btoa(String.fromCharCode(...result));
}
function streamCipherDecrypt(b64Text, key) {
    let bytes = atob(b64Text);
    let result = [];
    for (let i = 0; i < bytes.length; i++) {
        let keyChar = key.charCodeAt(i % key.length);
        result.push(String.fromCharCode(bytes.charCodeAt(i) ^ keyChar));
    }
    return result.join('');
}

// --- Combined Encryption/Decryption --- //
async function loadKeyFromFile() {
    const response = await fetch('key.txt');
    if (!response.ok) throw new Error('Failed to load key.txt');
    return response.text();
}
async function encryptBookingData(qrData, shift) {
    const key = await loadKeyFromFile();
    const jsonStr = JSON.stringify(qrData);
    const caesar = caesarEncrypt(jsonStr, shift);
    const stream = streamCipherEncrypt(caesar, key);
    return stream;
}
async function decryptBookingData(encryptedData, shift) {
    const key = await loadKeyFromFile();
    const caesar = streamCipherDecrypt(encryptedData, key);
    const decrypted = caesarDecrypt(caesar, shift);
    return JSON.parse(decrypted);
}

// --- QR Code Generation --- //
function generateQRCode(data, element) {
    element.innerHTML = '';
    try {
        const qrContainer = document.createElement('div');
        qrContainer.className = 'bg-white p-4 rounded-lg inline-block';
        element.appendChild(qrContainer);
        QRCode.toDataURL(data, {
            width: 350,
            margin: 6,
            errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#FFFFFF' }
        }, function(error, url) {
            if (error) {
                console.error("Error generating QR code data URL:", error);
                element.innerHTML = '<p class="text-red-500">Error generating QR code</p>';
                return;
            }
            const img = document.createElement('img');
            img.src = url;
            img.alt = "Booking QR Code";
            img.style.maxWidth = "100%";
            img.className = "mx-auto";
            qrContainer.appendChild(img);
        });
    } catch (e) {
        console.error("Error in QR code generation:", e);
        element.innerHTML = '<p class="text-red-500">Failed to generate QR code</p>';
    }
}

// --- Booking Storage --- //
function saveBookings(bookings) {
    document.body.dataset.bookings = JSON.stringify(bookings);
    renderSavedBookings();
}
function getBookings() {
    try {
        return document.body.dataset.bookings ? JSON.parse(document.body.dataset.bookings) : [];
    } catch (e) {
        console.error('Error getting bookings:', e);
        return [];
    }
}
if (!document.body.dataset.bookings) {
    document.body.dataset.bookings = JSON.stringify([]);
}

// --- Booking Form Submission --- //
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const participantName = document.getElementById('participantName').value;
    const contactMedium = document.getElementById('contactMedium').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const shiftKey = parseInt(document.getElementById('shiftKey').value, 10);

    // Save all fields locally
    const booking = {
        id: Date.now().toString(),
        participantName,
        contactMedium,
        username,
        password,
        shiftKey,
        createdAt: new Date().toISOString()
    };

    // QR code should NOT contain username or password
    const qrData = {
        id: booking.id,
        participantName,
        contactMedium,
        shiftKey,
        createdAt: booking.createdAt
    };

    // Encrypt and generate QR code using qrData only!
    try {
        const encryptedData = await encryptBookingData(qrData, shiftKey);
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        qrCodeContainer.innerHTML = '';
        generateQRCode(encryptedData, qrCodeContainer);
    } catch (err) {
        alert('Unable to generate QR code. Please make sure key.txt exists and is accessible.');
        return;
    }

    // Show booking details
    const bookingDetails = document.getElementById('bookingDetails');
    const bookingInfo = document.getElementById('bookingInfo');
    bookingDetails.classList.remove('hidden');
    bookingInfo.innerHTML = `
        <p><strong>Name:</strong> ${participantName}</p>
        <p><strong>Contact Medium:</strong> ${contactMedium}</p>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
    `;
    const downloadBtn = document.getElementById('downloadQR');
    if (downloadBtn) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = function() {
            alert('Right-click on the QR code and select "Save image as..." to download');
        };
    }

    // Save all fields to storage
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);
});

// --- Render Saved Bookings --- //
function renderSavedBookings() {
    const savedBookingsContainer = document.getElementById('savedBookings');
    const noBookingsElement = document.getElementById('noBookings');
    const bookings = getBookings();
    savedBookingsContainer.innerHTML = '';
    if (bookings.length === 0) {
        savedBookingsContainer.appendChild(noBookingsElement);
        return;
    }
    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'bg-white dark:bg-gray-700 p-4 rounded-lg shadow';
        bookingCard.innerHTML = `
            <div class="flex justify-between">
                <h3 class="font-bold">${booking.participantName}</h3>
                <button class="text-red-500 hover:text-red-700 delete-booking" data-id="${booking.id}">
                    ✕
                </button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">${booking.contactMedium}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">${booking.username}</p>
            <button class="view-qr mt-2 text-primary hover:text-primary/80 text-sm" data-id="${booking.id}">
                View QR Code
            </button>
        `;
        savedBookingsContainer.appendChild(bookingCard);
    });
    document.querySelectorAll('.delete-booking').forEach(button => {
        button.addEventListener('click', function() {
            const bookingId = this.getAttribute('data-id');
            deleteBooking(bookingId);
        });
    });
    document.querySelectorAll('.view-qr').forEach(button => {
        button.addEventListener('click', async function() {
            const bookingId = this.getAttribute('data-id');
            const bookings = getBookings();
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
                // Generate QR code only from qrData (do NOT include username/password)
                const qrData = {
                    id: booking.id,
                    participantName: booking.participantName,
                    contactMedium: booking.contactMedium,
                    shiftKey: booking.shiftKey,
                    createdAt: booking.createdAt
                };
                try {
                    const encryptedData = await encryptBookingData(qrData, booking.shiftKey);
                    const qrCodeContainer = document.getElementById('qrCodeContainer');
                    generateQRCode(encryptedData, qrCodeContainer);
                } catch (err) {
                    alert('Unable to generate QR code. Please make sure key.txt exists and is accessible.');
                    return;
                }

                const bookingDetails = document.getElementById('bookingDetails');
                const bookingInfo = document.getElementById('bookingInfo');
                bookingDetails.classList.remove('hidden');
                bookingInfo.innerHTML = `
                    <p><strong>Name:</strong> ${booking.participantName}</p>
                    <p><strong>Contact Medium:</strong> ${booking.contactMedium}</p>
                    <p><strong>Username:</strong> ${booking.username}</p>
                    <p><strong>Password:</strong> ${booking.password}</p>
                `;
                const downloadBtn = document.getElementById('downloadQR');
                if (downloadBtn) {
                    downloadBtn.classList.remove('hidden');
                    downloadBtn.onclick = function() {
                        alert('Right-click on the QR code and select "Save image as..." to download');
                    };
                }
            }
        });
    });
}

// --- Delete Booking --- //
function deleteBooking(bookingId) {
    if (confirm('Are you sure you want to delete this booking?')) {
        const bookings = getBookings();
        const updatedBookings = bookings.filter(booking => booking.id !== bookingId);
        saveBookings(updatedBookings);
    }
}

// --- CSV Export --- //
document.getElementById('exportCSV').addEventListener('click', function() {
    const bookings = getBookings();
    if (bookings.length === 0) {
        alert('No bookings to export');
        return;
    }
    const headers = ['ID', 'Name', 'Contact Medium', 'Username', 'Password', 'Created At'];
    let csvContent = headers.join(',') + '\n';
    bookings.forEach(booking => {
        const row = [
            booking.id,
            `"${booking.participantName.replace(/"/g, '""')}"`,
            `"${booking.contactMedium.replace(/"/g, '""')}"`,
            `"${booking.username.replace(/"/g, '""')}"`,
            `"${booking.password.replace(/"/g, '""')}"`,
            booking.createdAt
        ];
        csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 100);
});

// --- CSV Import --- //
document.getElementById('importCSV').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const csvData = event.target.result;
            const lines = csvData.split('\n');
            const headers = lines[0].split(',');
            const requiredHeaders = ['Name', 'Contact Medium', 'Username', 'Password'];
            const hasRequiredHeaders = requiredHeaders.every(header =>
                headers.some(h => h.trim() === header)
            );
            if (!hasRequiredHeaders) {
                alert('CSV file does not have the required headers. Please make sure it contains: ' + requiredHeaders.join(', '));
                return;
            }
            const nameIndex = headers.findIndex(h => h.trim() === 'Name');
            const contactMediumIndex = headers.findIndex(h => h.trim() === 'Contact Medium');
            const usernameIndex = headers.findIndex(h => h.trim() === 'Username');
            const passwordIndex = headers.findIndex(h => h.trim() === 'Password');
            function parseCSVRow(row) {
                const result = [];
                let insideQuotes = false;
                let currentValue = '';
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (char === '"') {
                        if (insideQuotes && row[i + 1] === '"') {
                            currentValue += '"';
                            i++;
                        } else {
                            insideQuotes = !insideQuotes;
                        }
                    } else if (char === ',' && !insideQuotes) {
                        result.push(currentValue);
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                result.push(currentValue);
                return result;
            }
            const bookings = getBookings();
            let importedCount = 0;
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = parseCSVRow(lines[i]);
                const participantName = values[nameIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                const contactMedium = values[contactMediumIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                const username = values[usernameIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                const password = values[passwordIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
                if (!participantName || !contactMedium || !username || !password) continue;
                const booking = {
                    id: Date.now().toString() + '_' + i,
                    participantName,
                    contactMedium,
                    username,
                    password,
                    shiftKey: 3,
                    createdAt: new Date().toISOString()
                };
                bookings.push(booking);
                importedCount++;
            }
            saveBookings(bookings);
            alert(`Successfully imported ${importedCount} bookings.`);
            e.target.value = '';
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Error importing CSV file. Please check the file format.');
        }
    };
    reader.readAsText(file);
});

// --- Initial Rendering --- //
renderSavedBookings();