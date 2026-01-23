/**
 * Theme Management Script
 * Handles light/dark mode toggling and persistence
 */

const ThemeManager = {
    init() {
        // Check for saved theme preference, default to dark if not set
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // If saved is light, or no saved and user DOES NOT prefer dark (meaning they prefer light or no preference)
        // Actually, original app default seems to be dark.
        // Let's stick to: Default is Dark. Only switch to Light if explicitly set.

        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        this.setupToggle();
    },

    setupToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            // Remove any existing listeners by cloning
            const newBtn = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

            newBtn.addEventListener('click', () => {
                this.toggle();
            });
        }
    },

    toggle() {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});

// Also expose global for inline calls if needed
window.ThemeManager = ThemeManager;
