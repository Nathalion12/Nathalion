import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Container, Typography, Box, CircularProgress, Alert, Paper, Button, Divider, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const Profile = () => {
  const { authState, loadUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authState.isAuthenticated && !authState.loading && authState.token) {
      loadUser();
    }
  }, [authState.isAuthenticated, authState.loading, authState.token, loadUser]);

  if (authState.loading) {
    return <Container sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)'}}><CircularProgress /></Container>;
  }

  if (!authState.isAuthenticated || !authState.user) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 5 }}>
        <Alert severity="warning" sx={{ mt: 3 }}>
          You are not logged in. Please <Button onClick={() => navigate('/login')}>login</Button> to view your profile.
        </Alert>
      </Container>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ padding: { xs: 2, sm: 3, md: 4 }, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AccountCircleIcon sx={{ fontSize: 60, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            My Profile
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="subtitle1" color="text.secondary">Username:</Typography>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Typography variant="h6">{authState.user.username}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="subtitle1" color="text.secondary">Email:</Typography>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Typography variant="h6">{authState.user.email}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="subtitle1" color="text.secondary">Joined:</Typography>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Typography variant="body1">{new Date(authState.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 4, textAlign: 'right' }}>
          <Button variant="contained" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};
export default Profile;
