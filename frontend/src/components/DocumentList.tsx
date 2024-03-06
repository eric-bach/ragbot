import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Link } from 'react-router-dom';
import { Grid, Typography, Button, Box } from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import { Document } from '../common/types';
import DocumentDetail from './DocumentDetail';
import { Loader } from '@aws-amplify/ui-react';

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setLoading] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    const documents = await API.get('ragbot-api', '/doc', {});
    setLoading(false);
    setDocuments(documents);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <React.Fragment>
      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '20px',
          paddingBottom: '6px',
        }}
      >
        <Typography variant='h4'>My documents</Typography>
        <Button
          onClick={fetchData}
          variant='outlined'
          color='primary'
          disabled={isLoading}
          startIcon={
            <CachedIcon
              style={{
                animation: isLoading ? 'spin 1s infinite linear' : 'none',
              }}
            />
          }
        >
          Refresh
        </Button>
      </Box>
      <Grid container spacing={4}>
        {documents.map((document: Document) => (
          <Grid item xs={12} sm={6} md={4} key={document.documentId}>
            <Link
              to={`/doc/${document.documentId}/${document.conversations[0].conversationId}/`}
              style={{
                display: 'block',
                padding: '6px',
                backgroundColor: 'white',
                border: '1px solid gray',
                borderRadius: '4px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <DocumentDetail {...document} />
            </Link>
          </Grid>
        ))}
      </Grid>
      {!isLoading && documents.length === 0 && (
        <Box
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '4px',
          }}
        >
          <Typography variant='subtitle1' fontWeight='bold'>
            There's nothing here yet...
          </Typography>
          <Typography variant='body1' style={{ marginTop: '1px' }}>
            Upload your first document to get started!
          </Typography>
        </Box>
      )}
      {isLoading && documents.length === 0 && <Loader variation='linear' style={{ paddingTop: '40px' }} />}
    </React.Fragment>
  );
};

export default DocumentList;
