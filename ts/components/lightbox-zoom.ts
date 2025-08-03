/*!
 * Image lightbox and gallery logic.
 *
 * Author: Julian Schönbächler (https://julian-s.ch/ | info@julian-s.ch)
 * Copyright: Julian Schönbächler, 2025
 * License: MPL-2.0
 */

// Image lightbox and gallery logic for browsers newer than >= 2015 (if transpiled accordingly) and even IE 11
// (using polyfills and not minding some styling bugs and broken transitions).
// The source targets ES2020.

// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not
// distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
//______________________________________________________________________________________________________________________

// Main Logic
//
// The lightbox element is instantiated at the end of the DOM in the documents body. It is activated by clicking on
// referenced <image>, <picture> <a> elements that have the lightbox 'data-' selector attribute. The lightbox itself
// creates a page-filling <picture> element for displaying images. It copies source and media type data from the image
// that triggered the lightbox. This gives the browser the ability to automatically select the best image source
// according to the new context the image is shown. This component is designed around this behavior: When the lightbox
// opens, it determines if the displayed image might fetch a new source that is not yet cached. If the image load or
// decode operation consequentially takes longer, the component automatically creates and displays a "preview" image
// using the source of the currently displayed image on the document. When the main image finished loading in the
// background, it is decoded and flipped with the preview displayed on the lightbox.
// Images on the document can be grouped into galleries for the lightmap component. When opening the lightmap, user can
// cycle through the grouped images.
// There is also a zooming functionality. Opened images can be zoomed-in if they were configured accordingly (again with
// 'data-' selector attributes). Zooming reacts to the mouse/pointer position (or touch panning on touch devices) on the
// displayed image. By moving the cursor over the image, every corner of it can be examined quite intuitively.
// Quite some work went into the carefully controlled sequence of adding/removing classes to the DOM elements while
// respecting and awaiting browser reflows and repaints. This allows for some fancy CSS transitions and animations when
// opening and closing the lightbox or when switching and zooming images.
//______________________________________________________________________________________________________________________

// Usage
//
// Only exported function is `init()`. Call it after the DOM of your document is fully loaded in order to initialize and
// set up the lightbox component. If your script is not a module, do this by either listening on the `DOMContentLoaded`
// event or by using the 'defer' attribute on your script tag.
//
//  =TypeScript=========================================================================================================
//  | import { init as initLightbox } from './lightbox-zoom.ts';
//  |
//  | initLightbox({
//  |   galleryLoop: false,
//  |   /* whatever other options to configure... */
//  | });
//  ====================================================================================================================
//
//  =HTML===============================================================================================================
//  | <!-- Lightbox can be triggered from a <picture> element. -->
//  | <picture data-lightbox="gallery1" data-lightbox-caption="Image 1" data-lightbox-zoom="2.0">
//  |   <source srcset="img/image1_small.webp 500w, img/image2_middle.webp 1000w, img/image2_big.webp 2000w"
//  |           sizes="50vw"
//  |           type="image/webp">
//  |   <source srcset="img/image1_small.jpg 500w, img/image2_middle.jpg 1000w, img/image2_big.jpg 2000w"
//  |           sizes="50vw"
//  |           type="image/jpeg">
//  |   <img src="img/image1_preview.jpg" alt="Image 1">
//  | </picture>
//  |
//  | <!-- An <img> element works too! -->
//  | <img data-lightbox="gallery1"
//  |      data-lightbox-caption="Image 2"
//  |      data-lightbox-zoom="1.5"
//  |      srcset="img/image2_small.png 500w, img/image2_middle.png 1000w, img/image2_big.png 2000w">
//  |      src="img/image2_preview.jpg"
//  |      alt="Image 2">
//  ====================================================================================================================
//
// Options:
// - dataSelector (string)
//      The `data-` selector attribute string for matching images in the document that should trigger the lightbox.
//      Default value: 'lightbox'
// - scope (Element | Document | NodeListOf<Element> | HTMLCollection)
//      The scope on which the lightbox should search for images on initialization.
//      Default value: document
// - galleryMode (boolean)
//      Activate or deactivate galler mode. Gallery mode groups images together that can be cycled through in the
//      lightbox. Groups are determined by the value of the `data-` selector attribute.
//      Default value: true
// - galleryLoop (boolean)
//      Loop image in a gallery. If looping is enabled, clicking next on the last image in a gallery loops back to the
//      first one.
//      Default value: true
// - loadFullResImmediately (boolean)
//      Respect the lightbox zoom value already on opening the lightbox and loading the buffer. Enabling this will
//      try to load the full-resolution image which is used on zooming upfront. This could therefore lead to longer load
//      times when opening large images. If disabled, the browser will choose the ideal source of the zoomed image only
//      when zooming is actually enabled.
//      Default value: false
// - loadTimeoutBeforePreview (number)
//      The timeout in milliseconds before a preview image will be created if the full resolution image is not done
//      fetching/loading and decoding.
//      Default value: 50
// - closeOnScroll (boolean)
//      Automatically close the lightbox component if the user scrolls the page. If this option is disabled, scrolling
//      the documents body is prevented using inline styling.
//      Default value: true
// - closeOnResize (boolean)
//      Automatically close the lightbox component if the user resizes the page.
//      Default value: false
// - scrollThreshold (number)
//      The scroll threshold in pixels before th lightbox close action is triggered. This option has only an effect
//      when 'closeOnScroll' is set to true.
//      Default value: 20
// - lightboxId (string)
//      The `id` attribute of the lightbox DOM element.
//      Default value: 'lightbox'
// - lightboxClassVisible (string)
//      The `class` added to the lightbox DOM element when it becomes visible (before actually opening).
//      Default value: 'visible'
// - lightboxClassOpen (string)
//      The `class` added to the lightbox DOM element when it opens.
//      Default value: 'open'
// - backgroundClass (string)
//      The `class` added to the background DOM element when the lightbox becomes visible.
//      Default value: 'background'
// - bufferClassLoad (string)
//      The `class` added to the lightbox buffer wrapper that is currently loading an image.
//      Default value: 'load'
// - bufferClassActive (string)
//      The `class` added to the lightbox buffer wrapper that becomes active (front buffer).
//      Default value: 'active'
// - bufferClassFront (string)
//      The `class` added to the lightbox buffer wrapper that will render as the front buffer (before becoming active).
//      Default value: 'front'
// - bufferClassZoom (string)
//      The `class` added to the lightbox buffer wrapper when it has image zooming active.
//      Default value: 'zoom'
// - buttonNextClass (string)
//      The `class` added to the lightbox 'next' button DOM element (<button>).
//      Default value: 'next'
// - buttonPreviousClass (string)
//      The `class` added to the lightbox 'previous' button DOM element (<button>).
//      Default value: 'previous'
// - buttonCloseClass (string)
//      The `class` added to the lightbox 'close' button DOM element (<button>).
//      Default value: 'close'
// - attributeHidden (string)
//      The attribute added to various DOM elements of the lightbox indicating that the element is hidden.
//      Default value: 'hidden'
//
// HTML attributes ({selector} refers to the 'dataSelector' option defaulting to 'lightbox')
// - data-{selector} (string?)
//      The main selector for referencing the element as an image that can be opened in a lightbox. If a value is
//      present, it acts as key for grouping the image for gallery mode.
// - data-{selector}-caption (string)
//      An image caption that should be displayed when showing this image in the lightbox.
// - data-{selector}-alt (string)
//      A fallback (alternate) text to display when the specified image is not loaded.
// - data-{selector}-src (string)
//      A manually specified source of the image element in the lightbox.
// - data-{selector}-zoom (number)
//      The zoom factor (multiplier) for the image in the lightbox. Zoom is only activated for images that have a zoom
//      factor greater than 1.
//______________________________________________________________________________________________________________________

import type { Timeout } from '../utils/general';

import { getTransitionDuration } from '../utils/transition';
import { debounce, waitForNextRepaint, waitForTimeout } from '../utils/general';

import { TimeoutError } from '../utils/timeout-error';
import { promiseWithTimeout } from '../utils/general';


//      _/_/_/_/_/  _/      _/  _/_/_/    _/_/_/_/    _/_/_/
//         _/        _/  _/    _/    _/  _/        _/
//        _/          _/      _/_/_/    _/_/_/      _/_/
//       _/          _/      _/        _/              _/
//      _/          _/      _/        _/_/_/_/  _/_/_/
//______________________________________________________________________________________________________________________

export interface Options {
    dataSelector?: string;
    scope?: Element | Document | NodeListOf<Element> | HTMLCollection;
    galleryMode?: boolean;
    galleryLoop?: boolean;
    loadFullResImmediately?: boolean;
    loadTimeoutBeforePreview?: number;
    closeOnScroll?: boolean;
    closeOnResize?: boolean;
    scrollThreshold?: number;
    lightboxId?: string;
    lightboxClassVisible?: string;
    lightboxClassOpen?: string;
    backgroundClass?: string;
    bufferClassLoad?: string;
    bufferClassActive?: string;
    bufferClassFront?: string;
    bufferClassZoom?: string;
    buttonNextClass?: string;
    buttonPreviousClass?: string;
    buttonCloseClass?: string;
    attributeHidden?: string;
}

interface ImageReference {
    readonly wrapper: HTMLElement;
    readonly image: HTMLImageElement | HTMLPictureElement;
    readonly next: ImageReference | null;
    readonly previous: ImageReference | null;
}

interface ImageLinkedReference extends Omit<ImageReference, 'next' | 'previous'> {
    next: ImageReference | null;
    previous: ImageReference | null;
}

const enum BufferState {
    Inactive,
    Active,
    Loading,
}

interface Buffer {
    state: BufferState;
    hideTransition: Timeout | null;
    isPreview: boolean;
    isZoomed: boolean;
    zoomFactor: number;
    readonly wrapper: HTMLElement;
    readonly picture: HTMLPictureElement;
    readonly image: HTMLImageElement;
    readonly caption?: HTMLElement;
}

const enum LightboxState {
    Closed,
    Opening,
    Open,
    Closing,
}

interface Lightbox {
    state: LightboxState;
    presentedImage: ImageReference | null;
    frontBuffer: Buffer;
    readonly swapChain: Map<ImageReference, Buffer>;
    readonly root: HTMLElement;
    readonly buttonNext: HTMLElement;
    readonly buttonPrevious: HTMLElement;
    readonly buttonClose: HTMLElement;
}


//           _/_/_/  _/          _/_/    _/_/_/      _/_/    _/          _/_/_/
//        _/        _/        _/    _/  _/    _/  _/    _/  _/        _/
//       _/  _/_/  _/        _/    _/  _/_/_/    _/_/_/_/  _/          _/_/
//      _/    _/  _/        _/    _/  _/    _/  _/    _/  _/              _/
//       _/_/_/  _/_/_/_/    _/_/    _/_/_/    _/    _/  _/_/_/_/  _/_/_/
//______________________________________________________________________________________________________________________

export const VERSION = '1.0.0';

let config: Required<Options>;
let lightbox: Lightbox;
let lightboxTransitionDuration: number;
let bufferTransitionDuration: number;
let zoomTransitionDuration: number;
let anchorScrollPosition: { x: number, y: number } | null = null;
let zoomedPanEvent: keyof Pick<GlobalEventHandlers, 'onpointermove' | 'ontouchmove' | 'onmousemove'>;


//          _/          _/_/      _/_/_/  _/_/_/    _/_/_/
//         _/        _/    _/  _/          _/    _/
//        _/        _/    _/  _/  _/_/    _/    _/
//       _/        _/    _/  _/    _/    _/    _/
//      _/_/_/_/    _/_/      _/_/_/  _/_/_/    _/_/_/
//______________________________________________________________________________________________________________________

/**
 * Creates a new image buffer for the lightbox and prepares the DOM representation accordingly (not injected).
 *
 * @param state - The initial state of the buffer.
 * @param isPreview - Flag indicating if the created buffer is holding preview image data.
 */
function createBuffer(state: BufferState = BufferState.Inactive, isPreview = false): Buffer {
    const buffer = {
        state,
        hideTransition: null,
        isPreview,
        isZoomed: false,
        zoomFactor: 1,
        wrapper: document.createElement('figure'),
        picture: document.createElement('picture'),
        image: document.createElement('img'),
        caption: document.createElement('figcaption'),
    } as Buffer;

    buffer.picture.append(buffer.image);
    buffer.wrapper.append(buffer.picture, buffer.caption!);

    switch (state) {
        case BufferState.Active:
            buffer.wrapper.className = `${config.bufferClassFront} ${config.bufferClassActive}`;
            break;

        case BufferState.Loading:
            buffer.wrapper.className = config.bufferClassLoad;
            break;

        default:
            buffer.wrapper.setAttribute(config.attributeHidden, config.attributeHidden);
            break;
    }

    return buffer;
}

/**
 * Creates the global lightbox and prepares the DOM representation accordingly (not injected).
 */
function createLightbox() {
    if (process.env.NODE_ENV === 'development') {
        console.assert(!lightbox, '[Lightbox] Already built!');
    }

    const frontBuffer = createBuffer(BufferState.Active, true);

    lightbox = {
        state: LightboxState.Closed,
        presentedImage: null,
        root: document.createElement('div'),
        frontBuffer,
        swapChain: new Map<ImageReference, Buffer>(),
        buttonNext: document.createElement('button'),
        buttonPrevious: document.createElement('button'),
        buttonClose: document.createElement('button'),
    };

    const backgroundDiv = document.createElement('div');
    backgroundDiv.className = config.backgroundClass;

    // Setting up node tree
    lightbox.root.append(
        frontBuffer.wrapper,
        lightbox.buttonNext,
        lightbox.buttonPrevious,
        lightbox.buttonClose,
        backgroundDiv,
    );

    // Node tree attribute data
    lightbox.root.id = config.lightboxId;
    lightbox.root.className = config.lightboxClassVisible;
    lightbox.root.setAttribute(config.attributeHidden, config.attributeHidden);
    lightbox.buttonNext.className = config.buttonNextClass;
    lightbox.buttonPrevious.className = config.buttonPreviousClass;
    lightbox.buttonClose.className = config.buttonCloseClass;

    if (!config.galleryMode) {
        lightbox.buttonNext.setAttribute(config.attributeHidden, config.attributeHidden);
        lightbox.buttonPrevious.setAttribute(config.attributeHidden, config.attributeHidden);
    }

    // Add event listeners
    lightbox.buttonClose.addEventListener('click', lightboxCloseHandler);
    lightbox.buttonNext.addEventListener('click', lightboxNextHandler);
    lightbox.buttonPrevious.addEventListener('click', lightboxPreviousHandler);

    // Instantiate and save
    document.body.appendChild(lightbox.root);

    // Query for transition styling and detect transition duration
    lightboxTransitionDuration = getTransitionDuration(
        lightbox.root,
        `div.${config.backgroundClass}, figcaption, img`,
    );
    bufferTransitionDuration = getTransitionDuration(frontBuffer.wrapper, true);
    zoomTransitionDuration = getTransitionDuration(frontBuffer.image);

    // Add some leeway to the transition timings
    if (lightboxTransitionDuration) {
        lightboxTransitionDuration += 100;
    }
    if (bufferTransitionDuration) {
        bufferTransitionDuration += 100;
    }

    // Clear class on lightbox --> into default state
    lightbox.root.className = '';
}

/**
 * Update the image ratio on a specified buffer. This function determines the major axis used to scale the image by
 * measuring the parent picture element. It applies styling to the image element (CSS width/height properties) so that
 * it stretches to the outer container without overflow.
 *
 * @param buffer - Buffer on which the image ratio should be updated.
 * @remarks This function will trigger a reflow in most browsers!
 */
function bufferUpdateImageRatio(buffer: Buffer) {
    const containerRatio = buffer.picture.clientWidth / buffer.picture.clientHeight;
    const imageRatio = buffer.image.naturalWidth / buffer.image.naturalHeight;

    if (imageRatio > containerRatio) {
        buffer.image.style.width = '100%';
        buffer.image.style.height = 'auto';
    } else {
        buffer.image.style.width = 'auto';
        buffer.image.style.height = '100%';
    }
}

/**
 * Swaps a given buffer to the front of the lightbox.
 *
 * @param buffer - The buffer to swap.
 */
async function bufferSwap(buffer: Buffer) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
    }

    // Already in correct state
    if (buffer.state === BufferState.Active) {
        return;
    }

    // Swap buffers
    const backBuffer = lightbox.frontBuffer;
    lightbox.frontBuffer = buffer;

    buffer.state = BufferState.Active;
    backBuffer.state = BufferState.Inactive;

    // Cancel and clear potential running transition timeouts on the new front buffer
    if (buffer.hideTransition) {
        buffer.hideTransition.cancel();
        buffer.hideTransition = null;
    }

    const immediate = (bufferTransitionDuration === 0) || !buffer.wrapper.parentElement ||
                      lightbox.state !== LightboxState.Open;

    buffer.wrapper.removeAttribute(config.attributeHidden);

    if (!immediate) {
        buffer.wrapper.className = config.bufferClassFront;
        backBuffer.wrapper.className = config.bufferClassActive;
        await waitForNextRepaint();
    }

    bufferUpdateImageRatio(buffer);
    buffer.wrapper.className = `${config.bufferClassFront} ${config.bufferClassActive}`;
    backBuffer.wrapper.className = '';

    if (!immediate) {
        // Await transition timeout
        backBuffer.hideTransition = waitForTimeout(bufferTransitionDuration);
        await backBuffer.hideTransition?.promise;
    }

    backBuffer.hideTransition = null;

    // Cleanup if inactive
    if (backBuffer.state === BufferState.Inactive) {
        // NOTE(julian): Check for buffer state is necessary! Maybe the buffer became the front buffer again while the
        //  timeout was running. We do not want to introduce side effects from assumptions.
        if (backBuffer.isPreview) {
            backBuffer.wrapper.remove();
        } else {
            backBuffer.wrapper.setAttribute(config.attributeHidden, config.attributeHidden);
        }
    }
}

/**
 * Zooms-in the image on a given buffer (by its zoom factor) and sets up the image panning logic.
 *
 * @param buffer - The buffer on which to zoom-in.
 * @remarks This function will trigger a reflow in most browsers!
 */
function bufferZoomIn(buffer: Buffer) {
    if (lightbox.state !== LightboxState.Open || buffer.isZoomed) {
        return;
    }

    // Update sizes property on source elements
    if (!config.loadFullResImmediately) {
        for (const sourceElement of buffer.picture.getElementsByTagName('source')) {
            sourceElement.sizes = `${buffer.zoomFactor * 100}vw`;
        }
    }

    buffer.isZoomed = true;
    buffer.picture.style.cursor = 'zoom-out';
    buffer.image.style.transform = `scale(${buffer.zoomFactor})`;

    // Calculate the relative position
    const wrapperRect = buffer.wrapper.getBoundingClientRect();
    const zoomPanMulti = (1 - buffer.zoomFactor) / buffer.zoomFactor;

    buffer.wrapper.classList.add(config.bufferClassZoom);
    buffer.wrapper[zoomedPanEvent] = (event: PointerEvent | TouchEvent | MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const clientX = (event as PointerEvent | MouseEvent).clientX ??
                        (event as TouchEvent).targetTouches[0]?.clientX;
        const clientY = (event as PointerEvent | MouseEvent).clientY ??
                        (event as TouchEvent).targetTouches[0]?.clientY;
        const posX = clientX !== undefined ? clientX - wrapperRect.left : window.screen.width * 0.5;
        const posY = clientY !== undefined ? clientY - wrapperRect.top : window.screen.height * 0.5;
        const normalizedX = Math.max(Math.min((posX - wrapperRect.width * 0.5) / wrapperRect.width, 0.5), -0.5);
        const normalizedY = Math.max(Math.min((posY - wrapperRect.height * 0.5) / wrapperRect.height, 0.5), -0.5);

        buffer.image.style.transform = `scale(${buffer.zoomFactor}) ` +
                                       `translate(${normalizedX * zoomPanMulti * 100}%,` +
                                       `${normalizedY * zoomPanMulti * 100}%)`;
    };
}

/**
 * Zooms-out of the image on a given buffer and clears the image panning logic.
 *
 * @param buffer - The buffer on which to zoom-out.
 */
function bufferZoomOut(buffer: Buffer) {
    if (!buffer.isZoomed) {
        return;
    }

    buffer.isZoomed = false;
    buffer.picture.style.cursor = 'zoom-in';
    buffer.image.style.transform = '';
    buffer.wrapper.classList.remove(config.bufferClassZoom);
    buffer.wrapper[zoomedPanEvent] = null;

    // Update sizes property on source elements
    if (!config.loadFullResImmediately) {
        for (const sourceElement of buffer.picture.getElementsByTagName('source')) {
            sourceElement.sizes = '100vw';
        }
    }
}

/**
 * Load a preview into a given buffer from an image reference. The preview image is the current image that is already
 * displayed on the image element of the reference. This image is in browser cache and can be loaded/decoded quickly
 * without fetching additional resources.
 *
 * @param buffer - The buffer to load the preview image into.
 * @param from - The image reference from which to gather the preview data and source.
 */
async function bufferLoadPreview(buffer: Buffer, from: ImageReference) {
    const imageElement = from.image instanceof HTMLImageElement
                         ? from.image
                         : from.image.querySelector('img')!;

    const captionText = from.wrapper.dataset[`${config.dataSelector}Caption`] ??
                        from.wrapper.querySelector('figcaption')?.textContent;
    const imageAlt = from.wrapper.dataset[`${config.dataSelector}Alt`] ?? imageElement.alt;
    const imageSrc = from.wrapper.dataset[`${config.dataSelector}Src`] ?? (imageElement.currentSrc || imageElement.src);

    // Remove all sources from the buffer picture element
    for (const sourceElement of buffer.picture.querySelectorAll('source')) {
        sourceElement.remove();
    }

    // Hook into load event for new image (before adding definite src attribute)
    const loadPromise = new Promise((resolve, reject) => {
        buffer.image.onload = resolve;
        buffer.image.onerror = reject;
    });

    // Explicitly set alternative and source
    buffer.image.src = imageSrc;
    buffer.image.alt = imageAlt;

    // Setup caption
    if (captionText && buffer.caption) {
        buffer.caption.textContent = captionText;
    }

    buffer.isPreview = true;
    await loadPromise;

    // Chain decoding after load event
    if ('decode' in HTMLImageElement) {
        await buffer.image.decode();
    }
}

/**
 * Load an image into a given buffer from an image reference. The image will have all sources and media types specified
 * on the reference. This gives the browser the ability to fetch a different source if applicable. Therefore, image
 * loading and decoding might take some time, as the browser fetches new data.
 *
 * @param buffer - The buffer to load the image into.
 * @param from - The image reference from which to gather the image data and source.
 */
async function bufferLoadImage(buffer: Buffer, from: ImageReference) {
    const imageElement = from.image instanceof HTMLImageElement
                         ? from.image
                         : from.image.querySelector('img')!;

        const captionText = from.wrapper.dataset[`${config.dataSelector}Caption`] ??
                        from.wrapper.querySelector('figcaption')?.textContent;
    const imageAlt = from.wrapper.dataset[`${config.dataSelector}Alt`] ?? imageElement.alt;
    const imageSrc = from.wrapper.dataset[`${config.dataSelector}Src`] ?? imageElement.src;
    const zoomFactor = from.wrapper.dataset[`${config.dataSelector}Zoom`]
                       ? parseFloat(from.wrapper.dataset[`${config.dataSelector}Zoom`]!)
                       : NaN;
    const imageSizes = config.loadFullResImmediately && zoomFactor > 1 ? `${zoomFactor * 100}vw` : '100vw';
    const sourceList = from.wrapper.querySelectorAll('source');

    // Setup image and sources
    {
        let i = 0;

        for (const sourceElement of buffer.picture.querySelectorAll('source')) {
            if (i < sourceList.length) {
                sourceElement.srcset = sourceList[i].srcset;
                // TODO(julian): Set the sizes either to 100vw or try to fetch the full-resolution image directly by
                //  also respecting the zoom factor.
                sourceElement.sizes = imageSizes;
                sourceElement.media = sourceList[i].media;
                sourceElement.type = sourceList[i].type;
            } else {
                sourceElement.remove();
            }

            i++;
        }

        for (; i < sourceList.length; i++) {
            const sourceElement = document.createElement('source');
            sourceElement.srcset = sourceList[i].srcset;
            sourceElement.sizes = imageSizes;
            sourceElement.media = sourceList[i].media;
            sourceElement.type = sourceList[i].type;
            buffer.picture.insertBefore(sourceElement, buffer.image);
        }
    }

    // Add buffer source according to the srcset and alt attribute of the image wrapper if there is any
    // NOTE(julian): Usually, there will be none for picture elements; that is why we doing this here as an addendum.
    if (imageElement.srcset) {
        const sourceElement = document.createElement('source');
        sourceElement.srcset = imageElement.srcset;
        sourceElement.sizes = imageSizes;
        buffer.picture.insertBefore(sourceElement, buffer.image);
    }

    // Hook into load event for new image (before adding definite src attribute)
    const loadPromise = new Promise((resolve, reject) => {
        buffer.image.onload = resolve;
        buffer.image.onerror = reject;
    });

    // Explicitly set alternative and source
    buffer.image.src = imageSrc;
    buffer.image.alt = imageAlt;

    // Setup caption
    if (captionText && buffer.caption) {
        buffer.caption.textContent = captionText;
    }

    // Setup zoom
    if (zoomFactor > 1) {
        buffer.zoomFactor = zoomFactor;
        buffer.picture.style.cursor = 'zoom-in';
        buffer.picture.onclick = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (!buffer.isZoomed) {
                bufferZoomIn(buffer);
            } else {
                bufferZoomOut(buffer);
            }
        };
    } else {
        buffer.zoomFactor = 1;
        buffer.picture.removeAttribute('style');
        buffer.picture.onclick = null;
    }

    buffer.isPreview = false;
    await loadPromise;

    // Chain decoding after load event
    if ('decode' in HTMLImageElement) {
        await buffer.image.decode();
    }
}

/**
 * Present a specified image (load and swap to front buffer) on the lightbox. This function controls the main logic of
 * the lightbox. It manages and caches buffers, loads images and previews if necessary.
 *
 * @param image - The reference to an image that should be presented on the lightbox.
 */
async function lightboxPresentImage(image: ImageReference) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
    }

    // NOTE(julian): We generally prevent presenting preview buffers while the lightbox is closing, but not while it is
    //  opening. We do not want visual artifacts while the lightbox closing transition is active. However, on opening,
    //  those potential artifacts are usually fine (preview buffer transitions away and full resolution image fades in).
    //  Furthermore, it is unlikely that an image fully finish loading while the opening transition (usually short) is
    //  active.

    const retrievedBuffer = lightbox.swapChain.get(image);
    lightbox.presentedImage = image;

    if (retrievedBuffer?.state === BufferState.Loading) {
        const previewBuffer = createBuffer(BufferState.Loading);
        lightbox.root.insertBefore(previewBuffer.wrapper, lightbox.buttonNext);

        // Load and decode the preview
        await waitForNextRepaint();
        await bufferLoadPreview(previewBuffer, image);

        // Check if image should still be swapped to front and preview still necessary
        if (lightbox.presentedImage === image && retrievedBuffer.state === BufferState.Loading) {
            await bufferSwap(previewBuffer);
        } else {
            previewBuffer.wrapper.remove();
        }

        return;
    }

    let imageBuffer: Buffer;
    let imageLoadPromise: Promise<void>;

    if (!retrievedBuffer) {
        imageBuffer = createBuffer(BufferState.Loading);
        lightbox.root.insertBefore(imageBuffer.wrapper, lightbox.buttonNext);
        lightbox.swapChain.set(image, imageBuffer);
        await waitForNextRepaint();
        imageLoadPromise = bufferLoadImage(imageBuffer, image);
    } else {
        imageBuffer = retrievedBuffer;
        imageLoadPromise = 'decode' in HTMLImageElement ? imageBuffer.image.decode() : Promise.resolve();
    }

    // NOTE(julian): After-load handler chained to the load promise (so that waiting on the load promise does not
    //  interfere with this handler). We can now timeout on the image load promise without affecting the swap logic
    //  post load.
    imageLoadPromise.then(async () => {
        // Check if image should still be swapped to front
        if (lightbox.presentedImage === image && lightbox.state !== LightboxState.Closing) {
            await bufferSwap(imageBuffer);
        } else {
            imageBuffer.state = BufferState.Inactive;
            imageBuffer.wrapper.className = '';
            imageBuffer.wrapper.setAttribute(config.attributeHidden, config.attributeHidden);
        }
    });

    try {
        await promiseWithTimeout(imageLoadPromise, config.loadTimeoutBeforePreview);
    } catch (e) {
        if (!(e instanceof TimeoutError)) {
            throw e;
        }

        // Image not yet ready --> create preview in the meantime...
        const previewBuffer = createBuffer(BufferState.Loading);
        lightbox.root.insertBefore(previewBuffer.wrapper, lightbox.buttonNext);

        await waitForNextRepaint();
        await bufferLoadPreview(previewBuffer, image);

        // Check if image should still be swapped to front and preview still necessary
        if (lightbox.presentedImage === image && imageBuffer.state !== BufferState.Active) {
            await bufferSwap(previewBuffer);
        } else {
            previewBuffer.wrapper.remove();
        }
    }
}

/**
 * The lightbox click event handler for the "next" button (image gallery).
 *
 * @param event - Mouse click event.
 */
// @ts-ignore(TS6133): Variable is declared but its value is never read.
async function lightboxNextHandler(event: MouseEvent) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
        console.assert(lightbox.state === LightboxState.Open, '[Lightbox] Lightbox is not open!');
    }

    if (lightbox.presentedImage?.next) {
        bufferZoomOut(lightbox.frontBuffer);
        lightbox.presentedImage.image.style.visibility = '';
        await lightboxPresentImage(lightbox.presentedImage.next);
        lightbox.presentedImage.image.style.visibility = 'hidden';
    }
}

/**
 * The lightbox click event handler for the "previous" button (image gallery).
 *
 * @param event - Mouse click event.
 */
// @ts-ignore(TS6133): Variable is declared but its value is never read.
async function lightboxPreviousHandler(event: MouseEvent) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
        console.assert(lightbox.state === LightboxState.Open, '[Lightbox] Lightbox is not open!');
    }

    if (lightbox.presentedImage?.previous) {
        bufferZoomOut(lightbox.frontBuffer);
        lightbox.presentedImage.image.style.visibility = '';
        await lightboxPresentImage(lightbox.presentedImage.previous);
        lightbox.presentedImage.image.style.visibility = 'hidden';
    }
}

/**
 * The lightbox click event handler for opening the lightbox.
 *
 * @param event - Mouse click event.
 */
async function lightboxOpenHandler(event: MouseEvent) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
        console.assert(lightbox.state !== LightboxState.Open, '[Lightbox] Lightbox is already open!');
        console.assert(lightbox.presentedImage, '[Lightbox] Lightbox has no image reference to present!');
    }

    event.preventDefault();
    lightbox.state = LightboxState.Opening;

    if (!config.closeOnScroll) {
        document.body.style.overflow = 'hidden';
    }

    // Present the image; this loads the image or preview into the front buffer
    await lightboxPresentImage(lightbox.presentedImage!);

    // NOTE(julian): Order is important! Calculating bounding rect triggers layout and reflow.
    lightbox.root.removeAttribute(config.attributeHidden);

    bufferUpdateImageRatio(lightbox.frontBuffer);

    const documentImageElement = lightbox.presentedImage!.image instanceof HTMLImageElement
                                 ? lightbox.presentedImage!.image
                                 : lightbox.presentedImage!.image.getElementsByTagName('img')[0];

    const fromRect = documentImageElement.getBoundingClientRect();
    const toRect = lightbox.frontBuffer.image.getBoundingClientRect();

    const unitDistX = toRect.width - fromRect.width;
    const unitDistY = toRect.height - fromRect.height;
    const startScaleX = fromRect.width / toRect.width;
    const startScaleY = fromRect.height / toRect.height;
    const originX = (fromRect.left - toRect.left) / unitDistX;
    const originY = (fromRect.top - toRect.top) / unitDistY;

    lightbox.frontBuffer.image.style.transformOrigin = `${originX * 100}% ${originY * 100}%`;
    lightbox.frontBuffer.image.style.transform = `scale(${startScaleX}, ${startScaleY})`;

    // Wait end of next animation frame to make sure reflow has happened in all browsers
    await waitForNextRepaint();

    // Make visible and open the lightbox
    lightbox.root.className = `${config.lightboxClassVisible} ${config.lightboxClassOpen}`;
    lightbox.presentedImage!.image.style.visibility = 'hidden';

    // Removing transform kicks off the transition
    lightbox.frontBuffer.image.style.transform = '';

    if (lightboxTransitionDuration > 0) {
        await waitForTimeout(lightboxTransitionDuration).promise;
    }

    lightbox.frontBuffer.image.style.transformOrigin = '';
    lightbox.state = LightboxState.Open;
}

/**
 * The lightbox click event handler for closing the lightbox.
 *
 * @param event - Mouse click event.
 */
// @ts-ignore(TS6133): Variable is declared but its value is never read.
async function lightboxCloseHandler(event: MouseEvent) {
    if (process.env.NODE_ENV === 'development') {
        console.assert(lightbox, '[Lightbox] No lightbox');
        console.assert(lightbox.state !== LightboxState.Closed, '[Lightbox] Lightbox is already closed!');
    }

    lightbox.state = LightboxState.Closing;

    // Account for zoomed buffer
    if (lightbox.frontBuffer.isZoomed) {
        bufferZoomOut(lightbox.frontBuffer);
        await waitForTimeout(zoomTransitionDuration).promise;
    }

    const documentImageElement = lightbox.presentedImage!.image instanceof HTMLImageElement
                                 ? lightbox.presentedImage!.image
                                 : lightbox.presentedImage!.image.getElementsByTagName('img')[0];

    const fromRect = lightbox.frontBuffer.image.getBoundingClientRect();
    const toRect = documentImageElement.getBoundingClientRect();

    const unitDistX = toRect.width - fromRect.width;
    const unitDistY = toRect.height - fromRect.height;
    const endScaleX = toRect.width / fromRect.width;
    const endScaleY = toRect.height / fromRect.height;
    const originX = (fromRect.left - toRect.left) / unitDistX;
    const originY = (fromRect.top - toRect.top) / unitDistY;

    lightbox.frontBuffer.image.style.transformOrigin = `${originX * 100}% ${originY * 100}%`;
    lightbox.frontBuffer.image.style.transform = `scale(${endScaleX}, ${endScaleY})`;

    // Decouple lightbox root element from the viewport so that the animation will look correct
    lightbox.root.className = config.lightboxClassVisible;
    lightbox.root.style.position = 'absolute';
    lightbox.root.style.top = `${window.scrollY}px`;
    lightbox.root.style.left = `${window.scrollX}px`;
    lightbox.root.style.right = 'auto';
    lightbox.root.style.bottom = 'auto';
    lightbox.root.style.width = '100%';
    lightbox.root.style.height = '100%';

    if (lightboxTransitionDuration > 0) {
        await waitForTimeout(lightboxTransitionDuration).promise;
    }

    lightbox.presentedImage!.image.style.visibility = '';
    lightbox.frontBuffer.image.removeAttribute('style');
    lightbox.root.className = '';
    lightbox.root.setAttribute(config.attributeHidden, config.attributeHidden);
    lightbox.root.removeAttribute('style');

    lightbox.state = LightboxState.Closed;

    if (!config.closeOnScroll) {
        document.body.style.overflow = '';
    }
}

/**
 * The lightbox scroll event handler for auto-closing the lightbox.
 *
 * @param event - Document scroll event.
 */
function lightboxScrollHandler(event: Event) {
    if (lightbox.state !== LightboxState.Open) {
        return;
    }

    const x = window.scrollX || (document.documentElement || document.body.parentElement || document.body).scrollLeft;
    const y = window.scrollY || (document.documentElement || document.body.parentElement || document.body).scrollTop;

    // No reference...
    if (anchorScrollPosition === null) {
        anchorScrollPosition = { x, y };
        return;
    }

    const deltaX = Math.abs(x - anchorScrollPosition.x);
    const deltaY = Math.abs(y - anchorScrollPosition.y);

    if (Math.max(deltaX, deltaY) > config.scrollThreshold) {
        anchorScrollPosition = null;
        lightboxCloseHandler(event as MouseEvent).then();
    }
}

/**
 * The lightbox resize event handler for recalculating the image ratio on the front buffer.
 *
 * @param event - Window resize event.
 */
// @ts-ignore(TS6133): Variable is declared but its value is never read.
function lightboxResizeHandler(event: Event) {
    if (config.closeOnResize && lightbox.state === LightboxState.Open) {
        return lightboxCloseHandler(event as MouseEvent);
    }

    if (lightbox.state === LightboxState.Open) {
        bufferUpdateImageRatio(lightbox.frontBuffer);
    }
}

/**
 * Initialize the lightbox on the document and setup image galleries and references. Call this (commonly once) after
 * the DOM has fully loaded.
 *
 * @param options - The lightbox options for configuration.
 * @remarks The lightbox logic runs on the whole document managing global state. It is not possible to create multiple
 *          lightbox "instances".
 */
export function init(options?: Options) {
    // Extend configuration with default values
    config = {
        dataSelector: 'lightbox',
        scope: document,
        galleryMode: true,
        galleryLoop: true,
        loadFullResImmediately: false,
        loadTimeoutBeforePreview: 50,
        closeOnScroll: true,
        closeOnResize: false,
        scrollThreshold: 20,
        lightboxId: 'lightbox',
        lightboxClassVisible: 'visible',
        lightboxClassOpen: 'open',
        backgroundClass: 'background',
        bufferClassLoad: 'load',
        bufferClassActive: 'active',
        bufferClassFront: 'front',
        bufferClassZoom: 'zoom',
        buttonNextClass: 'next',
        buttonPreviousClass: 'previous',
        buttonCloseClass: 'close',
        attributeHidden: 'hidden',
        ...options,
    };

    // Instantiate lightbox DOM structure if not yet built
    if (!lightbox) {
        createLightbox();
    }

    // Gather image elements that are tagged as lightbox openers and pack them into reference objects
    const gatheredImages = 'querySelectorAll' in config.scope
                           ? config.scope.querySelectorAll(`img[data-${config.dataSelector}],` +
                                                           `a[data-${config.dataSelector}] > img,` +
                                                           `figure[data-${config.dataSelector}] > img,` +
                                                           `picture[data-${config.dataSelector}],` +
                                                           `a[data-${config.dataSelector}] > picture,` +
                                                           `figure[data-${config.dataSelector}] > picture`)
                           : config.scope;

    const setupGalleryMap = new Map<string, [head: ImageLinkedReference, tail: ImageLinkedReference]>();

    // Loop through all the gathered image elements
    for (const imageElement of gatheredImages) {
        const image = {
            wrapper: imageElement.hasAttribute(`data-${config.dataSelector}`)
                     ? imageElement
                     : imageElement.parentElement!,
            image: imageElement,
            next: null,
            previous: null,
        } as ImageReference;

        // Setup linked list inside the image reference array
        const currentGalleryTag = image.wrapper.dataset[config.dataSelector];

        if (config.galleryMode && currentGalleryTag) {
            const galleryReferences = setupGalleryMap.get(currentGalleryTag);

            if (galleryReferences) {
                // galleryReferences[1] is tail
                (image as ImageLinkedReference).previous = galleryReferences[1];
                galleryReferences[1].next = image;
                galleryReferences[1] = image; // New tail
            } else {
                // Start new gallery
                setupGalleryMap.set(currentGalleryTag, [image, image]);
            }
        }

        // Disable potential redirections on anchor elements
        if (image.wrapper.tagName === 'A') {
            (image.wrapper as HTMLAnchorElement).href = '#';
        }

        // Setup lightbox event listeners
        image.wrapper.addEventListener('click', (event) => {
            lightbox.presentedImage = image;
            lightboxOpenHandler(event).then();
        });
    }

    // Gallery loop option: connect last image to first and vice versa
    if (config.galleryMode && config.galleryLoop) {
        setupGalleryMap.forEach(([head, tail]) => {
            if (head !== tail) {
                head.previous = tail;
                tail.next = head;
            }
        });
    }

    // Determine the pointer/touch move event available on this device
    zoomedPanEvent = 'onpointermove' in window
                     ? 'onpointermove'
                     : 'ontouchmove' in window || navigator.maxTouchPoints > 0
                       ? 'ontouchmove'
                       : 'onmousemove';

    if (config.closeOnScroll) {
        document.addEventListener('scroll', debounce(lightboxScrollHandler), true);
    }

    window.addEventListener('resize', debounce(lightboxResizeHandler), true);
}


//          _/_/_/    _/_/_/_/  _/      _/  _/_/_/    _/_/_/  _/_/_/    _/_/    _/      _/    _/_/_/
//         _/    _/  _/        _/      _/    _/    _/          _/    _/    _/  _/_/    _/  _/
//        _/_/_/    _/_/_/    _/      _/    _/      _/_/      _/    _/    _/  _/  _/  _/    _/_/
//       _/    _/  _/          _/  _/      _/          _/    _/    _/    _/  _/    _/_/        _/
//      _/    _/  _/_/_/_/      _/      _/_/_/  _/_/_/    _/_/_/    _/_/    _/      _/  _/_/_/
//______________________________________________________________________________________________________________________

// 1.0.0    (2025-08-03)    Initial release of component. <img>, <picture> and <a> elements can trigger lightbox.
//                          Functionality for lazyloading bigger images into back buffers, inclusive automatic swap.
//                          Gallery mode, basic styling, scroll and resize handling. Controlled sequence of adding and
//                          removing classes to DOM elements while respecting and awaiting browser reflows and repaints.
