import { Box, Button, Grid } from '@mui/material';
import { ChatBubble, AddCircle, Delete } from '@mui/icons-material';
import DocumentDetail from './DocumentDetail';
import { Conversation } from '../common/types';
import { getDateTime } from '../common/utilities';
import { Params } from 'react-router-dom';

interface ChatSidebarProps {
  params: Params;
  conversation: Conversation;
  isLoadingConversation: boolean;
  addConversation: () => Promise<void>;
  deleteDocument: () => Promise<void>;
  switchConversation: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ conversation, params, addConversation, switchConversation, deleteDocument, isLoadingConversation }) => {
  return (
    <Grid item={true} md={4}>
      <Box style={{ backgroundColor: '#f5f5f5', padding: '1rem' }}>
        <DocumentDetail {...conversation.document} />
      </Box>
      <Box style={{ padding: '0.75rem 0.5rem 1.25rem' }}>
        <Button
          disabled={isLoadingConversation}
          onClick={addConversation}
          variant='outlined'
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.625rem',
            border: '1px solid #e0e0e0',
            borderRadius: '0.25rem',
            backgroundColor: '#fafafa',
          }}
          startIcon={<AddCircle sx={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />}
        >
          Start a new conversation
        </Button>
        {conversation &&
          conversation.document.conversations.map((conversation, i) => (
            <Box key={i}>
              <Button
                id={conversation.conversationId}
                onClick={switchConversation}
                disabled={params.conversationId === conversation.conversationId}
                variant='outlined'
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                  padding: '0.625rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '0.25rem',
                  backgroundColor: '#fafafa',
                }}
                startIcon={<ChatBubble sx={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />}
              >
                {getDateTime(conversation.created)}
              </Button>
            </Box>
          ))}
        <Button
          disabled={isLoadingConversation}
          onClick={deleteDocument}
          variant='outlined'
          style={{
            width: '100%',
            display: 'inline-flex',
            color: 'red',
            alignItems: 'center',
            marginTop: '0.5rem',
            padding: '0.625rem',
            border: '1px solid #e0e0e0',
            borderRadius: '0.25rem',
            backgroundColor: '#fafafa',
          }}
          startIcon={<Delete sx={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />}
        >
          Delete document
        </Button>
      </Box>
    </Grid>
  );
};

export default ChatSidebar;
