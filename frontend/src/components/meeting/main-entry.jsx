// This is a simple entry point for the meeting app when loaded via HTML
// It makes the App component available globally as MeetingApp

// Import the main App component (this will be handled by the module system)
// For now, we'll assume App is already available

window.MeetingApp = window.App || App;

// If React is loaded globally, we can also render directly
if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
  console.log('React detected, meeting app ready');

  // Make App component available globally
  window.MeetingApp = App;

  // Auto-render if root element exists and config is available
  if (window.MEETING_CONFIG && document.getElementById('root')) {
    setTimeout(() => {
      ReactDOM.render(
        React.createElement(App, { config: window.MEETING_CONFIG }),
        document.getElementById('root')
      );
    }, 100);
  }
}