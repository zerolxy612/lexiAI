import React, { useState, useCallback, memo } from 'react';
import { Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CopyIcon from '@/assets/copy.png';
import RestartIcon from '@/assets/restart.png';
import DeleteIcon from '@/assets/delete.png';

interface BottomChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onCopy?: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
}

export const BottomChatInput = memo(
  ({
    onSend,
    disabled = false,
    placeholder = 'Send a message to LexiHK',
    onCopy,
    onRestart,
    onDelete,
  }: BottomChatInputProps) => {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');

    const handleSend = useCallback(() => {
      if (inputValue.trim() && onSend) {
        onSend(inputValue.trim());
        setInputValue('');
      }
    }, [inputValue, onSend]);

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend],
    );

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
    }, []);

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Main input container - adjust for sidebar */}
        <div className="flex justify-center items-end px-4 pb-10" style={{ marginLeft: '300px' }}>
          {/* Increased max-width for wider input box */}
          <div className="w-full max-w-5xl mx-auto pointer-events-auto">
            {/* Action icons above input box */}
            <div className="flex items-center gap-2 mb-3 px-2">
              <button
                onClick={onCopy}
                className="flex items-center justify-center p-1 hover:opacity-70 transition-opacity duration-200 border-none bg-transparent outline-none"
                disabled={disabled}
                title="Copy"
              >
                <img src={CopyIcon} alt="Copy" className="w-4 h-4" />
              </button>

              <button
                onClick={onRestart}
                className="flex items-center justify-center p-1 hover:opacity-70 transition-opacity duration-200 border-none bg-transparent outline-none"
                disabled={disabled}
                title="Restart"
              >
                <img src={RestartIcon} alt="Restart" className="w-4 h-4" />
              </button>

              <button
                onClick={onDelete}
                className="flex items-center justify-center p-1 hover:opacity-70 transition-opacity duration-200 border-none bg-transparent outline-none"
                disabled={disabled}
                title="Delete"
              >
                <img src={DeleteIcon} alt="Delete" className="w-4 h-4" />
              </button>
            </div>

            {/* Input box with deeper shadow and rounded corners */}
            <div
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              style={{
                boxShadow:
                  '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Slightly increased padding for better height */}
              <div className="flex items-center px-4 py-3 gap-3">
                {/* Text area - adjusted height for better appearance */}
                <textarea
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={1}
                  className="flex-1 resize-none border-none outline-none text-base placeholder-gray-500 bg-transparent min-h-[24px] max-h-32 overflow-y-auto"
                  style={{
                    lineHeight: '1.2',
                    scrollbarWidth: 'thin',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    // Ensure minimum height is respected while allowing growth
                    const newHeight = Math.max(24, Math.min(target.scrollHeight, 128));
                    target.style.height = newHeight + 'px';
                  }}
                />

                {/* Smaller send button */}
                <Button
                  type="primary"
                  shape="circle"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={disabled || !inputValue.trim()}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: disabled || !inputValue.trim() ? '#f0f0f0' : '#00968F',
                    borderColor: disabled || !inputValue.trim() ? '#f0f0f0' : '#00968F',
                  }}
                />
              </div>
            </div>

            {/* Disclaimer text - single line and centered relative to input box */}
            <div className="flex justify-center mt-4">
              <p className="text-xs text-gray-500 whitespace-nowrap">
                LexiHK may present inaccurate information. Please verify responses with reliable
                sources.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

BottomChatInput.displayName = 'BottomChatInput';
