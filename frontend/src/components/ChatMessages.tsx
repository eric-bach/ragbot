import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import CircularProgress from '@mui/material/CircularProgress';
import { Box, TextField, Grid, IconButton, List, Typography } from '@mui/material';
import { Conversation } from '../common/types';
import React from 'react';

interface ChatMessagesProps {
  prompt: string;
  conversation: Conversation;
  isLoadingMessage: boolean;
  handlePromptChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyPress: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  submitMessage: (event: any) => Promise<void>;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ prompt, conversation, isLoadingMessage, submitMessage, handlePromptChange, handleKeyPress }) => {
  return (
    <Grid item={true} md={8}>
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
        <List>
          {conversation.messages.map((message, i) => (
            <div key={i}>
              {message.type === 'ai' ? (
                <Typography
                  align='right'
                  sx={{
                    backgroundColor: '#1976d2',
                    borderTopLeftRadius: 30,
                    borderBottomLeftRadius: 30,
                    borderTopRightRadius: 30,
                    borderBottomRightRadius: 5,
                    padding: 2,
                    color: 'white',
                    width: '75%',
                    textAlign: 'right',
                    marginLeft: 'auto',
                    marginBottom: 2,
                  }}
                >
                  {message.data.content}
                </Typography>
              ) : (
                <Typography
                  align='left'
                  sx={{
                    backgroundColor: '#f5f5f5',
                    borderTopLeftRadius: 30,
                    borderBottomLeftRadius: 5,
                    borderTopRightRadius: 30,
                    borderBottomRightRadius: 30,
                    padding: 2,
                    width: '75%',
                    textAlign: 'left',
                    marginBottom: 2,
                  }}
                >
                  {message.data.content}
                </Typography>
              )}
            </div>
          ))}
          {isLoadingMessage && <CircularProgress size={40} sx={{ mt: 2 }} />}
        </List>
        <Box display='flex' alignItems='center'>
          <TextField
            disabled={isLoadingMessage}
            type='text'
            id='prompt'
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyPress}
            placeholder={'Ask ' + conversation.document.filename + ' anything...'}
            sx={{ width: '100%' }}
            InputProps={{
              endAdornment: (
                <IconButton type='submit' onClick={(e) => submitMessage(e)}>
                  <DoubleArrowIcon />
                </IconButton>
              ),
            }}
          />
        </Box>
      </Box>
    </Grid>
  );
};

export default ChatMessages;
