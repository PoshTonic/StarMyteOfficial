import React from "react";

interface GameImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * A thin wrapper around <img> that retries once with a cache-busting
 * query param when the service worker serves a stale 404.
 */
const GameImage = React.forwardRef<HTMLImageElement, GameImageProps>(
  ({ src, onError, ...props }, ref) => {
    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.currentTarget;
      if (!target.dataset.retried && src) {
        target.dataset.retried = "1";
        target.src = `${src}?t=${Date.now()}`;
      }
      onError?.(e);
    };

    return <img ref={ref} src={src} onError={handleError} {...props} />;
  }
);

GameImage.displayName = "GameImage";

export default GameImage;
