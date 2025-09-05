// --- Mobile Navigation Menu ---
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
    });
    
    document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }));
}

// --- Custom Message Box Function ---
function showMessageBox(message, isSuccess) {
    const existingBox = document.getElementById('messageBox');
    if (existingBox) {
        existingBox.remove();
    }

    const messageBox = document.createElement('div');
    messageBox.id = 'messageBox';
    messageBox.innerText = message;
    messageBox.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${isSuccess ? '#2ecc71' : '#e74c3c'};
        color: #ffffff;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1001;
        text-align: center;
        font-size: 1.1rem;
        opacity: 0;
        transition: opacity 0.5s;
    `;
    document.body.appendChild(messageBox);

    setTimeout(() => messageBox.style.opacity = 1, 10);

    setTimeout(() => {
        messageBox.style.opacity = 0;
        setTimeout(() => messageBox.remove(), 500);
    }, 3000);
}


// --- Main DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Chart.js Visualizations (for visualization.html) ---
    if (document.getElementById('weeklyUsageChart')) {
        fetch('/static/data/predictions.json')
            .then(response => response.json())
            .then(data => {
                const actualVsPredictedCtx = document.getElementById('actualVsPredictedChart').getContext('2d');
                new Chart(actualVsPredictedCtx, {
                    type: 'line',
                    data: {
                        labels: data.map(item => item.date),
                        datasets: [{
                            label: 'Actual Usage (kWh)',
                            data: data.map(item => item.actual),
                            borderColor: '#3498db',
                            borderWidth: 2,
                            tension: 0.2
                        }, {
                            label: 'Predicted Usage (TFT)',
                            data: data.map(item => item.predicted),
                            borderColor: '#e74c3c',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            tension: 0.2
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: false } } }
                });
            })
            .catch(error => console.error('Error loading chart data:', error));

        const weeklyCtx = document.getElementById('weeklyUsageChart').getContext('2d');
        new Chart(weeklyCtx, { type: 'line', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Energy Usage (kWh)', data: [12, 19, 15, 21, 18, 25, 22], backgroundColor: 'rgba(46, 204, 113, 0.2)', borderColor: '#2ecc71', borderWidth: 2, tension: 0.4 }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
        const applianceCtx = document.getElementById('applianceChart').getContext('2d');
        new Chart(applianceCtx, { type: 'doughnut', data: { labels: ['HVAC', 'Refrigerator', 'Lighting', 'Washing Machine', 'Other'], datasets: [{ label: 'Consumption by Appliance', data: [40, 25, 15, 10, 10], backgroundColor: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#95a5a6'] }] }, options: { responsive: true } });
        const heatmapCtx = document.getElementById('heatmapChart').getContext('2d');
        new Chart(heatmapCtx, { type: 'bar', data: { labels: ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h'], datasets: [{ label: 'Average Usage (kWh)', data: [5, 15, 20, 18, 25, 22], backgroundColor: ['#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#b2182b', '#67001f'] }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    }

    // --- Form Handling ---
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const contactForm = document.querySelector('.contact-form form');
    const predictionForm = document.getElementById('predictionForm');

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(loginForm);
            fetch('/login', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    showMessageBox(data.message, data.success);
                    if(data.success) {
                        setTimeout(() => window.location.href = '/home', 1000);
                    }
                })
                .catch(error => console.error('Error:', error));
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showMessageBox('Passwords do not match!', false);
                return;
            }

            const formData = new FormData(registerForm);
            fetch('/register', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    showMessageBox(data.message, data.success);
                    if (data.success) {
                        setTimeout(() => window.location.href = '/login', 1500);
                    }
                })
                .catch(error => console.error('Error:', error));
        });
    }
    
    if (contactForm) {
        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(contactForm);
            fetch('/contact', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    showMessageBox(data.message, data.success);
                    if (data.success) {
                        contactForm.reset();
                    }
                })
                .catch(error => console.error('Error:', error));
        });
    }

    // --- Prediction Form Handling ---
    let predictionChart = null;
    let lastHourlyData = []; // Variable to store the latest chart data

    if (predictionForm) {
        predictionForm.addEventListener('submit', (event) => {
            event.preventDefault(); 
            
            const formData = new FormData(predictionForm);
            const data = Object.fromEntries(formData.entries());

            const resultDiv = document.getElementById('predictionResult');
            const resultP = resultDiv.querySelector('p');
            const showChartBtn = document.getElementById('showChartBtn');
            const chartContainer = document.getElementById('predictionChartContainer');

            resultP.textContent = 'Calculating...';
            resultDiv.style.display = 'block';
            showChartBtn.style.display = 'none';
            chartContainer.style.display = 'none';

            fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    resultP.textContent = result.prediction;
                    showChartBtn.style.display = 'inline-block';
                    lastHourlyData = result.hourly_data; // **FINAL FIX**: Store the new data

                } else {
                    resultP.textContent = `Error: ${result.error}`;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resultP.textContent = 'An error occurred. Check server console for details.';
            });
        });

        // Attach event listener to the button separately
        const showChartBtn = document.getElementById('showChartBtn');
        if (showChartBtn) {
            showChartBtn.addEventListener('click', () => {
                const chartContainer = document.getElementById('predictionChartContainer');
                chartContainer.style.display = 'block';
                const ctx = document.getElementById('predictionChart').getContext('2d');
                
                if (predictionChart) {
                    predictionChart.destroy();
                }

                predictionChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                        datasets: [{
                            label: 'Predicted Load (MWh)',
                            data: lastHourlyData, // **FINAL FIX**: Always use the stored data
                            borderColor: '#2ecc71',
                            backgroundColor: 'rgba(46, 204, 113, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: { display: true, text: 'Energy Load (MWh)' }
                            },
                            x: {
                                title: { display: true, text: 'Hour of the Day' }
                            }
                        }
                    }
                });
            });
        }
    }
});
