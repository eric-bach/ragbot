export interface Document {
  documentId: string;
  userId: string;
  filename: string;
  filesize: string;
  docStatus: string;
  created: string;
  pages: string;
  conversations: {
    conversationId: string;
    created: string;
  }[];
}

export interface Conversation {
  conversationId: string;
  document: Document;
  messages: {
    type: string;
    data: {
      content: string;
      example: boolean;
      additional_kwargs: {};
    };
  }[];
}
