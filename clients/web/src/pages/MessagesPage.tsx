import { useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Smile, Search, Phone, Video, MoreVertical, Plus } from 'lucide-react';

const conversations = [
  { id: '1', name: 'Sarah Chen', lastMsg: 'Sure, let\'s meet Friday!', time: '2m', unread: 2, online: true, isGroup: false },
  { id: '2', name: 'Research Group - AI', lastMsg: 'Dr. Kumar: Updated the paper draft', time: '1h', unread: 5, online: false, isGroup: true },
  { id: '3', name: 'Mike Ross', lastMsg: 'Thanks for the referral!', time: '3h', unread: 0, online: true, isGroup: false },
  { id: '4', name: 'Prof. Williams', lastMsg: 'The deadline is next week', time: '1d', unread: 0, online: false, isGroup: false },
  { id: '5', name: 'CS Alumni Group', lastMsg: 'Anyone hiring interns?', time: '2d', unread: 12, online: false, isGroup: true },
];

const messages = [
  { id: '1', sender: 'Sarah Chen', content: 'Hey! How\'s the project going?', time: '10:30 AM', isMine: false },
  { id: '2', sender: 'me', content: 'Going great! Almost done with the frontend.', time: '10:32 AM', isMine: true },
  { id: '3', sender: 'Sarah Chen', content: 'That\'s awesome! Can we schedule a review meeting?', time: '10:33 AM', isMine: false },
  { id: '4', sender: 'me', content: 'Sure! How about Friday at 2pm?', time: '10:35 AM', isMine: true },
  { id: '5', sender: 'Sarah Chen', content: 'Sure, let\'s meet Friday!', time: '10:36 AM', isMine: false },
];

const MessagesPage = () => {
  const [selectedConvo, setSelectedConvo] = useState(conversations[0]);
  const [showConvoList, setShowConvoList] = useState(true);
  const [messageInput, setMessageInput] = useState('');

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border bg-card lg:h-[calc(100vh-7rem)]">
      {/* Conversation List */}
      <div className={cn(
        'w-full border-r md:w-80 md:block flex-shrink-0',
        !showConvoList && 'hidden md:block'
      )}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h2 className="text-base font-semibold text-card-foreground">Messages</h2>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search conversations..." />
          </div>
        </div>
        <div className="overflow-y-auto scrollbar-thin" style={{ height: 'calc(100% - 7.5rem)' }}>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedConvo(c); setShowConvoList(false); }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary',
                selectedConvo.id === c.id && 'bg-accent'
              )}
            >
              <UserAvatar name={c.name} size="sm" online={c.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <span className="text-xs text-muted-foreground">{c.time}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.lastMsg}</p>
              </div>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn('flex flex-1 flex-col', showConvoList && 'hidden md:flex')}>
        {/* Chat Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowConvoList(true)} className="md:hidden"><span className="text-primary">← Back</span></button>
            <UserAvatar name={selectedConvo.name} size="sm" online={selectedConvo.online} />
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedConvo.name}</p>
              <p className="text-xs text-muted-foreground">{selectedConvo.online ? 'Online' : 'Offline'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Phone className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Video className="h-4 w-4" /></button>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.isMine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5',
                  msg.isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                )}>
                  <p className="text-sm">{msg.content}</p>
                  <p className={cn('mt-1 text-xs', msg.isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Paperclip className="h-5 w-5" /></button>
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Smile className="h-5 w-5" /></button>
            <button className="rounded-lg bg-primary p-2.5 text-primary-foreground hover:bg-primary/90">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
