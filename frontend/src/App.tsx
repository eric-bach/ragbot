import { Amplify, Auth } from 'aws-amplify';
import { Authenticator, Theme, ThemeProvider, View } from '@aws-amplify/ui-react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import Layout from './routes/Layout';
import Documents from './routes/Documents';
import Chat from './routes/Chat';

import './index.css';
import { Typography } from '@mui/material';

Amplify.configure({
  Auth: {
    userPoolId: import.meta.env.VITE_USER_POOL_ID,
    userPoolWebClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    region: import.meta.env.VITE_REGION,
  },
  API: {
    endpoints: [
      {
        name: 'ragbot-api',
        endpoint: import.meta.env.VITE_API_ENDPOINT,
        region: import.meta.env.VITE_REGION,
        custom_header: async () => {
          return {
            Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`,
          };
        },
      },
    ],
  },
});

const theme: Theme = {
  name: 'Theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          '10': '#1976d2',
          '20': '#1976d2',
          '40': '#1976d2',
          '60': '#1976d2',
          '80': '#1976d2',
          '90': '#1976d2',
          '100': '#1976d2',
        },
      },
    },
  },
};

const formFields = {
  signIn: {
    username: {
      label: 'Email',
      placeholder: 'Enter your email',
    },
  },
  signUp: {
    username: {
      label: 'Email',
      placeholder: 'Enter your email',
      order: 1,
    },
    password: {
      order: 2,
    },
    confirm_password: {
      order: 3,
    },
  },
};

const components = {
  SignIn: {
    Header() {
      return (
        <>
          <Typography variant='h5' align='center' sx={{ pt: 1 }}>
            RAGBot
          </Typography>
          <Typography variant='body1' align='center'>
            Sign into your account
          </Typography>
        </>
      );
    },
  },
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        Component: Documents,
      },
      {
        path: '/doc/:documentid/:conversationid',
        Component: Chat,
      },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <View paddingTop='6em'>
        <Authenticator formFields={formFields} components={components} hideSignUp={true}>
          <RouterProvider router={router} />
        </Authenticator>
      </View>
    </ThemeProvider>
  );
}

export default App;
