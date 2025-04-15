import mitt from 'mitt';

type Events = {
  update: {
    canvasId: string;
    pageId: string;
  };
};

export const slideshowEmitter = mitt<Events>();

export const createSlideshowUpdateEventName = (canvasId: string) => `slideshow.update.${canvasId}`;
