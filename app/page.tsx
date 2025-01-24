"use client";

import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserInfo from './components/Auth/UserInfo';
import App from './components/App';
import { XIcon } from "./components/icons/XIcon";
import { LinkedInIcon } from "./components/icons/LinkedInIcon";
import { FacebookIcon } from "./components/icons/FacebookIcon";

const Home = () => {
  return (
    <ProtectedRoute>
      <div className="h-full overflow-hidden">
        <UserInfo />
        
        {/* New simple header */}
        <div className="bg-white border-b h-[4rem] flex items-center">
          <header className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-gray-800 text-center">
              Live Voice Real-time Transcription
            </h1>
          </header>
        </div>

        {/* Adjust main height to account for header */}
        <main className="mx-auto px-4 md:px-6 lg:px-8 h-[calc(100%-8rem)]">
          <App />
        </main>

        {/* Footer */}
        <div className="bg-black/80 h-[4rem] flex items-center absolute w-full bottom-0">
          <footer className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8 flex items-center justify-center gap-4 md:text-xl font-inter text-[#8a8a8e]">
            <span className="text-base text-[#4e4e52]">share it</span>
            <a
              href="#"
              onClick={(e) => {
                window.open(
                  "https://twitter.com/intent/tweet?text=%F0%9F%94%A5%F0%9F%8E%89%20Check%20out%20this%20awesome%20%23AI%20demo%20by%20%40Deepgram%20and%20%40lukeocodes%0A%0A%20https%3A//aura-tts-demo.deepgram.com",
                  "",
                  "_blank, width=600, height=500, resizable=yes, scrollbars=yes"
                );
                return e.preventDefault();
              }}
              aria-label="share on twitter"
              target="_blank"
            >
              <XIcon className="mb-1" />
            </a>
            <a
              href="#"
              onClick={(e) => {
                window.open(
                  "https://www.linkedin.com/shareArticle?mini=true&url=https%3A//aura-tts-demo.deepgram.com&title=Excellent review on my website reviews",
                  "",
                  "_blank, width=600, height=500, resizable=yes, scrollbars=yes"
                );

                return e.preventDefault();
              }}
              aria-label="share on Linkedin"
            >
              <LinkedInIcon className="mb-1" />
            </a>
            <a
              href="#"
              onClick={(e) => {
                window.open(
                  "https://www.facebook.com/sharer/sharer.php?u=https%3A//aura-tts-demo.deepgram.com",
                  "",
                  "_blank, width=600, height=500, resizable=yes, scrollbars=yes"
                );

                return e.preventDefault();
              }}
              target="_blank"
              aria-label="share on Facebook"
            >
              <FacebookIcon className="mb-1" />
            </a>
            <div className="border-l border-[#4e4e52] w-px h-7">&nbsp;</div>
            <a
              className="text-base font-semibold"
              href="https://deepgram.com/contact-us"
              target="_blank"
            >
              contact us
            </a>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Home;
