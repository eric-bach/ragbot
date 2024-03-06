import React, { ChangeEvent, useState } from 'react';
import { API } from 'aws-amplify';
import { Button, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Loader } from '@aws-amplify/ui-react';
import { CheckCircle } from '@mui/icons-material';

const DocumentUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [buttonStatus, setButtonStatus] = useState<string>('ready');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    setButtonStatus('uploading');

    await API.get('ragbot-api', '/generate_presigned_url', {
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters: {
        file_name: selectedFile?.name,
      },
    }).then((presigned_url) => {
      fetch(presigned_url.presignedurl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': 'application/pdf' },
      }).then(() => {
        setButtonStatus('success');
      });
    });
  };

  const resetInput = () => {
    setSelectedFile(null);
    setButtonStatus('ready');
  };

  return (
    <div>
      <Typography variant='h4'>Add document</Typography>
      {!selectedFile ? (
        <label
          htmlFor='upload-file'
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '16rem',
            border: '2px dashed #ccc',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            background: '#f9f9f9',
          }}
        >
          <CloudUploadIcon
            style={{
              width: '2rem',
              height: '2rem',
              marginBottom: '0.75rem',
              color: '#888',
            }}
          />
          <Typography variant='body1' style={{ marginBottom: '0.5rem', color: '#888' }}>
            <span style={{ fontWeight: 'bold' }}>Click to upload</span> your document
          </Typography>
          <Typography variant='body2' style={{ fontSize: '0.8rem', color: '#888' }}>
            Only .pdf supported
          </Typography>
          <input id='upload-file' type='file' accept='.pdf' onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '16rem',
            border: '2px dashed #ccc',
            borderRadius: '0.5rem',
            background: '#f9f9f9',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <CloudUploadIcon style={{ width: '2.5rem', height: '2.5rem', color: '#888' }} />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginLeft: '0.5rem',
              }}
            >
              <Typography variant='subtitle1' style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {selectedFile.name}
              </Typography>
              <Typography variant='body2'>{selectedFile.size} bytes</Typography>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {buttonStatus === 'ready' && (
              <React.Fragment>
                <Button onClick={() => setSelectedFile(null)} variant='outlined'>
                  Cancel
                </Button>
                <Button onClick={handleUpload} variant='contained' color='primary'>
                  Upload
                </Button>
              </React.Fragment>
            )}
          </div>
          {buttonStatus === 'uploading' && <Loader variation='linear' filledColor='#1976d2' style={{ marginTop: 5 }} />}
          {buttonStatus === 'success' && (
            <Button color='success' endIcon={<CheckCircle />} onClick={() => resetInput()} variant='contained'>
              Upload another
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
