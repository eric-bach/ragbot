import React, { useEffect, useState, KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API, Auth } from 'aws-amplify';
import { Grid } from '@mui/material';
import { Loader } from '@aws-amplify/ui-react';
import ChatSidebar from '../components/ChatSidebar';
import ChatMessages from '../components/ChatMessages';
import { Conversation } from '../common/types';

const Chat: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [isLoadingChat, setLoadingChat] = React.useState<boolean>(false);
  const [isLoadingConversation, setLoadingConversation] = useState<boolean>(false);
  const [isLoadingMessage, setLoadingMessage] = useState<boolean>(false);

  const [conversation, setConversation] = React.useState<Conversation | null>(null);
  const [prompt, setPrompt] = useState('');

  const [client, setClient] = useState<WebSocket>();

  const initializeClient = async () => {
    console.log('Initializing WebSocket client');

    const idToken = (await Auth.currentSession()).getIdToken().getJwtToken();
    const client = new WebSocket(`${import.meta.env.VITE_API_WEBSOCKET_ENDPOINT}?idToken=${idToken}`);

    client.onopen = (e) => {
      console.log('WebSocket connection established.');
    };

    client.onerror = (e: any) => {
      console.error(e);

      setTimeout(async () => {
        await initializeClient();
      });
    };

    client.onclose = () => {
      if (!closed) {
        setTimeout(async () => {
          await initializeClient();
        });
      } else {
        console.log('WebSocket connection closed.');
      }
    };

    client.onmessage = async (message: any) => {
      const event = JSON.parse(message.data);
      console.log(`Received message for ${event.conversationId}`, event);

      setPrompt('');
      fetchData(event.conversationId); //conversation?.conversationId
      setLoadingMessage(false);
    };

    setClient(client);
  };

  const fetchData = async (conversationid = params.conversationid) => {
    setLoadingChat(true);

    console.log('Fetching data', conversationid);
    const conversation = await API.get('ragbot-api', `/doc/${params.documentid}/${conversationid}`, {});
    console.log('Received data', conversation);
    setConversation(conversation);

    setLoadingChat(false);

    navigate(`/doc/${params.documentid}/${conversationid}`);
  };

  useEffect(() => {
    initializeClient();

    fetchData();
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const addConversation = async () => {
    setLoadingConversation(true);

    const newConversation = await API.post('ragbot-api', `/doc/${params.documentid}`, {});
    fetchData(newConversation.conversationId);
    navigate(`/doc/${params.documentid}/${newConversation.conversationId}`);

    setLoadingConversation(false);
  };

  const switchConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
    const targetButton = e.target as HTMLButtonElement;

    navigate(`/doc/${params.documentid}/${targetButton.id}`);
    fetchData(targetButton.id);
  };

  const deleteDocument = async () => {
    await API.del('ragbot-api', `/doc/${conversation?.document.documentId}/${conversation?.conversationId}`, {
      body: { fileName: conversation?.document.filename },
    });
    navigate('/');
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key == 'Enter') {
      submitMessage(event);
    }
  };

  const submitMessage = async (event: any) => {
    setLoadingMessage(true);

    console.log('Submitting ', conversation?.conversationId);

    const user = await Auth.currentAuthenticatedUser();

    if (event.key !== 'Enter') {
      return;
    }

    client?.send(
      JSON.stringify({
        action: 'GenerateResponse',
        fileName: conversation?.document.filename,
        conversationId: conversation?.conversationId,
        userId: user.attributes.sub,
        prompt: prompt,
        token: (await Auth.currentSession()).getIdToken().getJwtToken(),
      })
    );
  };

  return (
    <>
      {isLoadingChat && !conversation && <Loader variation='linear' style={{ paddingTop: '40px' }} />}
      {conversation && (
        <div>
          <Grid container columns={12}>
            <ChatSidebar
              conversation={conversation}
              params={params}
              addConversation={addConversation}
              switchConversation={switchConversation}
              deleteDocument={deleteDocument}
              isLoadingConversation={isLoadingConversation}
            />
            <ChatMessages
              prompt={prompt}
              conversation={conversation}
              isLoadingMessage={isLoadingMessage}
              submitMessage={(e: any) => submitMessage(e)}
              handleKeyPress={handleKeyPress}
              handlePromptChange={handlePromptChange}
            />
          </Grid>
        </div>
      )}
    </>
  );
};

export default Chat;
