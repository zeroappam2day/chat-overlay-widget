interface Props {
  state: 'waiting' | 'connecting' | 'connected' | 'error';
  lastMessage: string | null;
  onSendTest: () => void;
}

export function ConnectionStatus({ state, lastMessage, onSendTest }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white font-mono">
      <h1 className="text-2xl mb-6">Chat Overlay Widget</h1>

      <div className="mb-4">
        {state === 'waiting' && (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
            <span>Waiting for sidecar...</span>
          </div>
        )}
        {state === 'connecting' && (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-yellow-400 border-t-transparent rounded-full" />
            <span>Connecting to WebSocket...</span>
          </div>
        )}
        {state === 'connected' && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-green-400 rounded-full" />
            <span>Connected</span>
          </div>
        )}
        {state === 'error' && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-red-400 rounded-full" />
            <span>Connection failed</span>
          </div>
        )}
      </div>

      {state === 'connected' && (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onSendTest}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
          >
            Send Test Message
          </button>
          {lastMessage && (
            <div className="mt-2 p-3 bg-gray-800 rounded text-sm max-w-md">
              <span className="text-gray-400">Response: </span>
              <span className="text-green-300">{lastMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
