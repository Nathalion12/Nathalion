import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link as RouterLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Register from './components/Auth/Register';
import Login from './components/Auth/Login';
import Profile from './components/Profile/Profile';
import ConversationList from './components/Messaging/ConversationList'; // Import new component
import ChatView from './components/Messaging/ChatView'; // Import new component
import { AppBar, Toolbar, Typography, Button, Container, Box, CircularProgress } from '@mui/material';

// A wrapper for protected routes
const PrivateRoute = ({ children }) => {
  const { authState } = useAuth();
  if (authState.loading) {
    return <Container sx={{display: 'flex', justifyContent: 'center', mt: 5}}><CircularProgress /></Container>;
  }
  return authState.isAuthenticated ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { authState, logout } = useAuth();

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
            Do Me A Favor
          </Typography>
          {authState.isAuthenticated ? (
            <>
              <Button color="inherit" component={RouterLink} to="/messages">Messages</Button> {/* Link to messages */}
              <Button color="inherit" component={RouterLink} to="/profile">Profile</Button>
              <Button color="inherit" onClick={logout}>Logout</Button>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">Login</Button>
              <Button color="inherit" component={RouterLink} to="/register">Register</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 1, mb: 1 }}> {/* Adjusted margins for better layout with chat view */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><ConversationList /></PrivateRoute>} />
          <Route path="/messages/:chatPartnerId" element={<PrivateRoute><ChatView /></PrivateRoute>} />
          {/* Add other routes here */}
        </Routes>
      </Container>
    </>
  );
};

const Home = () => (
  <Box sx={{textAlign: 'center', mt: 5}}>
    <Typography variant="h3" component="h1" gutterBottom>
      Welcome to Do Me A Favor!
    </Typography>
    <Typography variant="h5" component="p" color="textSecondary" paragraph>
      The best place to post tasks and get them done by others, or help someone out!
    </Typography>
    { !useAuth().authState.isAuthenticated &&
      <Button variant="contained" color="primary" size="large" component={RouterLink} to="/register" sx={{mr: 2}}>
        Get Started - Sign Up
      </Button>
    }
    <Button variant="outlined" color="primary" size="large" component={RouterLink} to={useAuth().authState.isAuthenticated ? "/profile" : "/login"}>
      {useAuth().authState.isAuthenticated ? "View Your Profile" : "Login to Your Account"}
    </Button>
  </Box>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
