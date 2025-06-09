// Function to update navigation
function updateNavigation() {
    fetch('data/navigation.json?' + new Date().getTime())  // Prevent caching
        .then(response => response.json())
        .then(data => {
            // Set navbar width from JSON
            const navbar = document.querySelector('.navbar');
            navbar.style.width = `${data.width}vw`;

            // Clear existing links
            const navLinks = document.querySelector('.nav-links');
            navLinks.classList.remove('ready');  // Remove transitions temporarily
            navLinks.innerHTML = '';

            // Add new links
            data.links.forEach((link, index) => {
                const a = document.createElement('a');
                a.href = link.href;
                a.className = 'nav-link';
                // Set active class if this is the current page
                if (link.href === location.hash || (!location.hash && link.href === '#home')) {
                    a.classList.add('active');
                    // Position the pill under the active link
                    navLinks.style.setProperty('--active-index', index);
                }
                a.textContent = link.name;
                if (link.width) { // Optional custom width
                    a.style.width = `${parseInt(link.width) / 1920 * 100}vw`;
                }
                navLinks.appendChild(a);
            });
        })
        .catch(error => console.error('Error loading navigation:', error));
}

// Initial load
updateNavigation();

// Update active state when hash changes
window.addEventListener('hashchange', () => {
    const links = document.querySelectorAll('.nav-link');
    links.forEach((link, index) => {
        if (link.getAttribute('href') === location.hash) {
            // Update the CSS variable for the pill position
            link.closest('.nav-links').style.setProperty('--active-index', index);
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});
