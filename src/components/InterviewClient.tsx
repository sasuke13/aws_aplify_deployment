import React, { useEffect, useRef, useState } from 'react';
import './InterviewClient.css';

interface ChatItem {
  id: string;
  question_block: {
    question: string;
    user_response?: string;
    agent_response?: string;
  };
}

interface InterviewClientProps {
  accessToken?: string;
}

const InterviewClient: React.FC<InterviewClientProps> = ({ accessToken }) => {
  const [status, setStatus] = useState<string>('Disconnected');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentChatItemIdRef = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${process.env.REACT_APP_INTERVIEW_SERVICE_HOST}/interview_service`);
      ws.binaryType = "arraybuffer";
      
      ws.onopen = () => {
        if (accessToken) {
          ws.send(JSON.stringify({
            action: 'authenticate',
            payload: {
              token: accessToken
            }
          }));
        }
        setStatus('Connected');
      };

      ws.onclose = (event) => {
        setStatus('Disconnected');
        if (event.code !== 1000) { // 1000 is normal closure
          setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Error connecting');
      };

      ws.onmessage = handleMessage;
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect:', error);
      setStatus('Connection failed');
    }
  };

  const handleMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    
    if (data.event === 'initial_chat_data') {
      if (data.data.chat_items) {
        setMessages(data.data.chat_items.chat_items);
        setHasMore(data.data.chat_items.has_more);
        setCurrentPage(data.data.chat_items.current_page);
      }
    } else if (data.event === 'user_response_processed' || data.event === 'new_question') {
      setMessages(prev => [...prev, data.data.chat_item]);
      currentChatItemIdRef.current = data.data.chat_item.id;
    }
  };

  const loadMoreMessages = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setCurrentPage(prev => {
        wsRef.current?.send(JSON.stringify({
          action: 'get_chat_items',
          payload: {
            page: prev + 1
          }
        }));
        return prev + 1;
      });
    }
  };

  const sendTextResponse = () => {
    if (userInput.trim() && currentChatItemIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'submit_user_response',
        payload: {
          chat_item_id: currentChatItemIdRef.current,
          response: userInput.trim()
        }
      }));
      setUserInput('');
    }
  };

  const toggleRecording = async () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const base64String = await blobToBase64(audioBlob);
        
        wsRef.current?.send(JSON.stringify({
          action: 'submit_user_response',
          payload: {
            chat_item_id: currentChatItemIdRef.current,
            response: `data:audio/wav;base64,${base64String}`
          }
        }));
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.replace('data:audio/wav;base64,', ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="interview-client">
      <div className="status">{status}</div>
      <div className="chat-container" ref={chatContainerRef}>
        {hasMore && (
          <div className="load-more">
            <button onClick={loadMoreMessages}>Load More</button>
          </div>
        )}
        {messages.map((item, index) => (
          <div key={index} className="message-group">
            <div className="message question">{item.question_block.question}</div>
            {item.question_block.user_response && (
              <div className="message response">
                {item.question_block.user_response.startsWith('data:audio/wav;base64,') ? (
                  <audio controls>
                    <source src={item.question_block.user_response} type="audio/wav" />
                  </audio>
                ) : (
                  item.question_block.user_response
                )}
              </div>
            )}
            {item.question_block.agent_response && (
              <div className="message agent">
                {item.question_block.agent_response.startsWith('data:audio/wav;base64,') ? (
                  <audio controls>
                    <source src={item.question_block.agent_response} type="audio/wav" />
                  </audio>
                ) : (
                  item.question_block.agent_response
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your response..."
        />
        <button onClick={sendTextResponse}>Send</button>
        <button
          onClick={toggleRecording}
          className={isRecording ? 'recording' : ''}
        >
          {isRecording ? 'Stop Recording' : 'Record'}
        </button>
      </div>
    </div>
  );
};

export default InterviewClient; 