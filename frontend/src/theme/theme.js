import { createTheme } from '@mui/material/styles';

// Example: Define a basic theme (can be expanded)
// For an "Android 16" feel, we might lean towards slightly rounded corners,
// clear typography, and potentially a specific color palette if provided.
// For now, let's ensure good defaults.
const theme = createTheme({
  palette: {
    // mode: 'light', // or 'dark'
    primary: {
      main: '#6200EE', // A typical Material Design purple
    },
    secondary: {
      main: '#03DAC6', // A typical Material Design teal
    },
    background: {
      default: '#f4f6f8', // Light grey background for a cleaner look
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
        fontWeight: 500,
    },
    h6: {
        fontWeight: 500,
    }
  },
  shape: {
    borderRadius: 8, // Slightly more rounded corners for components
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none', // Flatter app bar
          // backgroundColor: '#FFFFFF', // Example: White app bar
          // color: '#000000'
        }
      }
    },
    MuiButton: {
        styleOverrides: {
            root: {
                textTransform: 'none', // Less shouty buttons
                // borderRadius: 20 // Pill-shaped buttons if desired
            }
        }
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                // boxShadow: '0px 1px 3px rgba(0,0,0,0.1)' // Softer shadows
            }
        }
    }
  }
});

export default theme;
