import React from 'react';
import { GoogleIcon, SparklesIcon } from './icons';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-dark-bg text-text-light flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <SparklesIcon className="w-16 h-16 mb-4 text-accent-pink mx-auto" />
        <h1 className="text-4xl md:text-5xl font-bold font-display text-text-light">
          Welcome to Pikaza
        </h1>
        <p className="text-text-medium mt-4 max-w-md">
          Your AI-powered toolkit for creating consistent characters, storyboards, and video prompts. Please sign in to continue.
        </p>
      </div>

      <div className="mt-12">
        <button
            onClick={onLogin}
            className="flex items-center justify-center gap-3 w-full py-4 px-8 border-transparent rounded-2xl shadow-lg text-lg font-bold text-dark-bg bg-text-light hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-white disabled:opacity-50 transition-all duration-300 hover:scale-105 transform active:scale-100"
        >
          <GoogleIcon className="w-6 h-6" />
          Sign in with Google
        </button>
      </div>
       <p className="text-xs text-text-medium mt-8 text-center max-w-sm">
            By signing in, you agree to use the application responsibly. Thumbnail generation uses your personal Gemini API quota, which requires you to select your own API key.
        </p>
    </div>
  );
};
