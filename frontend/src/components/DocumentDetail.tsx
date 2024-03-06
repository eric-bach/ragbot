import { Document } from '../common/types';
import { getDateTime } from '../common/utilities';
import { filesize } from 'filesize';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloudIcon from '@mui/icons-material/Cloud';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { Typography, Box, CardContent } from '@mui/material';
import React from 'react';

const DocumentDetail: React.FC<Document> = (document: Document) => {
  return (
    <React.Fragment>
      <CardContent>
        <Typography variant='h6' align='center' mb={1} fontWeight='bold' sx={{ color: '#333' }}>
          {document.filename}
        </Typography>
        {document.docStatus === 'UPLOADED' && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                color: '#333',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                marginRight: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              <CloudIcon sx={{ width: 16, height: 16, marginRight: 1 }} />
              Awaiting processing
            </Box>
          </Box>
        )}
        {document.docStatus === 'PROCESSING' && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                marginRight: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              <RotateRightIcon sx={{ width: 16, height: 16, marginRight: 1 }} />
              Processing document
            </Box>
          </Box>
        )}
        {document.docStatus === 'READY' && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#e8f5e9',
                color: '#388e3c',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                marginRight: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              <CheckCircleIcon sx={{ width: 16, height: 16, marginRight: 1 }} />
              Ready to chat
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 1 }}>
          <InsertDriveFileIcon sx={{ width: 16, height: 16, mr: 1 }} />
          <Typography variant='body2'>{document.pages} pages</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CloudIcon sx={{ width: 16, height: 16, mr: 1 }} />
          <Typography variant='body2'>{filesize(Number(document.filesize)).toString()}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <ScheduleIcon sx={{ width: 16, height: 16, mr: 1 }} />
          <Typography variant='body2'>{getDateTime(document.created)}</Typography>
        </Box>
      </CardContent>
    </React.Fragment>
  );
};

export default DocumentDetail;
