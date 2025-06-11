// Cache for preloaded pages
const pageCache = {};

// Function to preload a page
async function preloadPage(url) {
    let fetchUrl = url;
    
    // Normalize URLs for fetching
    if (url === '/' || url === '') {
        fetchUrl = '/index.html'; // Normalize root URL for fetching
    } else if (url.endsWith('/')) {
        fetchUrl = url + 'index.html'; // Add index.html to directory URLs
    }
    
    // Use the original URL as cache key to maintain link relationships
    const cacheKey = url;
    
    // Don't reload if already in cache
    if (pageCache[cacheKey]) {
        return pageCache[cacheKey];
    }
    
    try {
        const response = await fetch(fetchUrl);
        const html = await response.text();
        
        // Create a temporary DOM to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Store the page content and essential data
        pageCache[cacheKey] = {
            title: doc.title,
            content: doc.body.innerHTML,
            styles: Array.from(doc.querySelectorAll('style')).map(style => style.textContent)
        };
        
        return pageCache[cacheKey];
    } catch (error) {
        console.error('Error preloading page:', url, error);
        return null;
    }
}

// Function to transition to a new page without reloading
function transitionToPage(url) {
    // Try multiple possible cache keys for the URL
    const cachedPage = pageCache[url] || // Direct match
                       pageCache[url + 'index.html'] || // With index.html
                       (url === '/' && pageCache['/']) || // Root special case
                       (url === '/' && pageCache['/index.html']); // Root with index.html
    
    if (cachedPage) {
        console.log('Found cached page for:', url);
        
        // Update the title
        document.title = cachedPage.title;
        
        // Update the URL without reloading
        window.history.pushState({}, cachedPage.title, url);
        
        // Replace content - keep only the navigation
        const navElement = document.querySelector('nav.navbar');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cachedPage.content;
        
        // Extract everything from the body except navigation
        const newContent = document.createDocumentFragment();
        const bodyChildren = Array.from(tempDiv.children);
        let newNavFound = false;
        
        bodyChildren.forEach(child => {
            if (child.tagName === 'NAV' && child.classList.contains('navbar')) {
                // We'll keep our existing nav
                newNavFound = true;
            } else {
                // Add everything else
                newContent.appendChild(child.cloneNode(true));
            }
        });
        
        // Clear everything except navigation
        const currentBody = document.body;
        
        // Replace content
        currentBody.innerHTML = '';
        currentBody.appendChild(navElement);
        currentBody.appendChild(newContent);
        
        // Re-run any scripts in the body (avoid duplicating the navigation script)
        const scripts = Array.from(document.querySelectorAll('body script:not([src="/script.js"])'));
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;
            script.parentNode.replaceChild(newScript, script);
        });
        
        // Trigger a custom event to notify any page-specific code
        document.dispatchEvent(new CustomEvent('pageChanged', { detail: { url } }));
        return true;
    } else {
        console.warn('No cached page found for:', url);
    }
    
    // If page wasn't preloaded successfully, do a normal navigation
    return false;
}

// Preload all navigation links when page loads
function preloadAllNavLinks() {
    fetch('/data/navigation.json?' + new Date().getTime())
        .then(response => response.json())
        .then(data => {
            // Preload all pages in the navigation
            data.links.forEach(link => {
                // Always preload, even current page (helps with back button)
                console.log('Preloading:', link.href);
                preloadPage(link.href).then(cached => {
                    if (cached) {
                        console.log('Successfully preloaded:', link.href);
                    }
                });
            });
        })
        .catch(error => console.error('Error loading navigation for preload:', error));
}

// Function to update navigation
function updateNavigation() {
    fetch('/data/navigation.json?' + new Date().getTime())  // Prevent caching
        .then(response => response.json())
        .then(data => {            // We're now using CSS to maintain aspect ratio
            // No need to set width from JSON as it's calculated based on height
            document.documentElement.style.setProperty('--navbar-ratio', data.width / 6.02);

            // Clear existing links
            const navLinks = document.querySelector('.nav-links');
            navLinks.innerHTML = '';
            navLinks.classList.remove('visible'); // Keep hidden while building

            let activeIndex = 0; // Default to first item
            
            // Create all links first
            data.links.forEach((link, index) => {
                const a = document.createElement('a');
                a.href = link.href;
                a.className = 'nav-link';
                
                // Set active class if this is the current page
                const currentPath = window.location.pathname;
                // Handle root path case - check for exact match or starting with
                const isActive = (link.href === '/' && currentPath === '/') || 
                               (link.href !== '/' && currentPath.startsWith(link.href));
                               
                if (isActive) {
                    a.classList.add('active');
                    // Save the active index but don't set it yet
                    activeIndex = index;
                }
                a.textContent = link.name;                
                navLinks.appendChild(a);
                  // Add click handler to animate before navigation
                a.addEventListener('click', function(e) {
                    // Only process if this isn't already the active link
                    if (!this.classList.contains('active')) {
                        // Prevent default navigation
                        e.preventDefault();
                        
                        // Get all links and find this link's index
                        const allLinks = Array.from(document.querySelectorAll('.nav-link'));
                        const clickedIndex = allLinks.indexOf(this);
                        
                        // Remove active class from all links
                        allLinks.forEach(link => link.classList.remove('active'));
                        
                        // Add active class to clicked link
                        this.classList.add('active');
                        
                        // Update the pill position with animation
                        navLinks.classList.add('ready'); // Enable transitions
                        navLinks.style.setProperty('--active-index', clickedIndex);
                          // Get the href for navigation
                        const href = this.getAttribute('href');
                        
                        // Special case for home page - ensure it's preloaded
                        if (href === '/' && !pageCache['/'] && !pageCache['/index.html']) {
                            console.log('Home page not in cache, preloading now');
                            preloadPage('/').then(() => {
                                console.log('Home preload complete');
                            });
                        }
                        
                        // Start smooth scroll to top animation (300ms ease-in-out)
                        const startScroll = window.pageYOffset || document.documentElement.scrollTop;
                        const startTime = performance.now();
                        const duration = 300; // 300ms to match transition timing
                        
                        function easeInOut(t) {
                            // Cubic ease-in-out function
                            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
                        }
                        
                        function animateScroll(currentTime) {
                            const elapsed = currentTime - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            const easedProgress = easeInOut(progress);
                            
                            // Calculate current scroll position
                            const currentScroll = startScroll * (1 - easedProgress);
                            window.scrollTo(0, currentScroll);
                            
                            if (progress < 1) {
                                requestAnimationFrame(animateScroll);
                            }
                        }
                        
                        // Start the scroll animation
                        requestAnimationFrame(animateScroll);
                        
                        // Wait for animation to complete then transition seamlessly
                        setTimeout(() => {
                            console.log('Attempting transition to:', href);
                            // Try seamless transition first, fallback to normal navigation
                            if (!transitionToPage(href)) {
                                console.log('Fallback to normal navigation:', href);
                                window.location.href = href; // Fallback
                            }
                        }, 300); // Match transition duration in CSS
                    }
                });
            });
            
            // Position the active pill *before* making it visible
            navLinks.style.setProperty('--active-index', activeIndex);
            
            // Make the navigation visible only after the pill is positioned
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    navLinks.classList.add('visible');
                    
                    // Enable transitions for future animations only after everything is visible
                    setTimeout(() => {
                        navLinks.classList.add('ready');
                    }, 50);
                });
            });
        })
        .catch(error => console.error('Error loading navigation:', error));
}

// Function to load footer content
function loadFooter() {
    fetch('/data/footer.json?' + new Date().getTime())
        .then(response => response.json())
        .then(data => {
            const footerContent = document.querySelector('.footer-content');
            if (!footerContent) return;
            
            // Clear existing content
            footerContent.innerHTML = '';
            
            // Create categories container
            const categoriesContainer = document.createElement('div');
            categoriesContainer.className = 'footer-categories';
            
            // Add each section
            Object.entries(data.sections).forEach(([key, section]) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'footer-category';
                
                // Create title
                const title = document.createElement('div');
                title.className = 'footer-category-title';
                title.textContent = section.title;
                categoryDiv.appendChild(title);
                
                // Create links container
                const linksDiv = document.createElement('div');
                linksDiv.className = 'footer-links';
                
                // Add links
                section.links.forEach(link => {
                    const a = document.createElement('a');
                    a.href = link.href;
                    a.className = 'footer-link';
                    a.textContent = link.name;
                    
                    // Add target="_blank" for external links
                    if (link.href.startsWith('http') || link.href.startsWith('mailto:')) {
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                    }
                    
                    linksDiv.appendChild(a);
                });
                
                categoryDiv.appendChild(linksDiv);
                categoriesContainer.appendChild(categoryDiv);
            });
            
            footerContent.appendChild(categoriesContainer);
            
            // Add logo
            const logo = document.createElement('img');
            logo.src = data.logo.src;
            logo.alt = data.logo.alt;
            logo.className = 'footer-logo';
            
            // Add click handler for logo if it has a link
            if (data.logo.link) {
                logo.style.cursor = 'pointer';
                logo.addEventListener('click', () => {
                    window.location.href = data.logo.link;
                });
            }
            
            footerContent.appendChild(logo);
        })
        .catch(error => console.error('Error loading footer:', error));
}

// Initial load
updateNavigation();
loadFooter();

// Preload all navigation pages after a short delay
// This allows the current page to finish rendering first
setTimeout(() => {
    preloadAllNavLinks();
}, 300);

// Store the initial page in cache immediately 
// This helps with back button navigation
const initialUrl = window.location.pathname || '/';
console.log('Caching initial page:', initialUrl);
pageCache[initialUrl] = {
    title: document.title,
    content: document.body.innerHTML
};

// Handle back/forward browser navigation
window.addEventListener('popstate', function(e) {
    const currentPath = window.location.pathname;
    console.log('Navigation state changed to:', currentPath);
    
    // Check if we have this page in cache
    if (pageCache[currentPath]) {
        // Use the cached content
        transitionToPage(currentPath);
    } else {
        // Just update the navigation pill position
        updateNavigation();
    }
});

// Listen for page changes to reload footer
document.addEventListener('pageChanged', function(e) {
    // Reload footer content after page transition
    setTimeout(() => {
        loadFooter();
    }, 100); // Small delay to ensure new page content is loaded
});
