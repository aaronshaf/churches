import type { FC } from 'hono/jsx';
import type { ChurchImage } from '../types';
import { BlurhashImage } from './BlurhashImage';

interface ChurchImageUploadProps {
  churchImages: Array<{
    id: number;
    imagePath: string;
    imageAlt: string | null;
    caption: string | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    sortOrder: number;
    isFeatured: boolean;
  }>;
  domain: string;
  r2Domain?: string;
  churchId?: number;
}

export const ChurchImageUpload: FC<ChurchImageUploadProps> = ({ churchImages = [], domain, r2Domain, churchId }) => {
  return (
    <div class="sm:col-span-6">
      <label class="block text-sm font-medium leading-6 text-gray-900 mb-4">Church Images</label>

      {/* Existing Images */}
      {churchImages.length > 0 && (
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-900 mb-3">
            Current Images
            <span class="text-xs font-normal text-gray-500 ml-2">(Drag to reorder - first image is primary)</span>
          </h4>
          <div id="sortable-images" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {churchImages.map((image, index) => (
              <div
                key={image.id}
                class="border border-gray-200 rounded-lg p-4 cursor-move relative"
                draggable="true"
                data-image-id={image.id}
                data-sort-order={index}
              >
                {image.isFeatured && (
                  <div class="absolute -top-2 -left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded z-10">
                    Primary
                  </div>
                )}
                <div class="space-y-3">
                  <div class="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                    {image.blurhash && image.width && image.height ? (
                      <BlurhashImage
                        imageId={image.id}
                        path={image.imagePath}
                        alt={image.imageAlt || 'Church image'}
                        width={image.width}
                        height={image.height}
                        blurhash={image.blurhash}
                        className="w-full h-full object-cover"
                        domain={domain}
                        r2Domain={r2Domain}
                      />
                    ) : (
                      <img
                        src={r2Domain ? `https://${r2Domain}/${image.imagePath}` : `/${image.imagePath}`}
                        alt={image.imageAlt || 'Church image'}
                        class="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <input type="hidden" name={`imageIds`} value={image.id} />
                  <input type="hidden" name={`imageSortOrders`} value={index} />

                  <div class="space-y-2">
                    <div>
                      <label for={`imageAlt-${image.id}`} class="block text-xs font-medium text-gray-700">
                        Alt Text
                      </label>
                      <input
                        type="text"
                        id={`imageAlt-${image.id}`}
                        name={`imageAlts`}
                        value={image.imageAlt || ''}
                        placeholder="Describe the image"
                        class="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label for={`imageCaption-${image.id}`} class="block text-xs font-medium text-gray-700">
                        Caption
                      </label>
                      <input
                        type="text"
                        id={`imageCaption-${image.id}`}
                        name={`imageCaptions`}
                        value={image.caption || ''}
                        placeholder="Optional caption"
                        class="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>

                    <div class="flex items-center gap-2">
                      <label class="flex items-center text-xs">
                        <input
                          type="checkbox"
                          name={`imagePrimary`}
                          value={image.id}
                          checked={image.isFeatured}
                          class="mr-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        Primary Image
                      </label>
                      <button
                        type="button"
                        class="text-xs text-red-600 hover:text-red-500 ml-auto"
                        onclick={`if(confirm('Remove this image?')) { 
                          this.closest('div[data-image-id]').style.display = 'none'; 
                          const input = document.createElement('input');
                          input.type = 'hidden';
                          input.name = 'removeImages';
                          input.value = '${image.id}';
                          this.closest('form').appendChild(input);
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload New Images */}
      <div>
        <h4 class="text-sm font-medium text-gray-900 mb-3">Add New Images</h4>

        {/* Drop Zone */}
        <div
          id="drop-zone"
          class="relative border-2 border-gray-300 border-dashed rounded-lg p-6 hover:border-gray-400 transition-colors"
        >
          <div class="text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p class="mt-2 text-sm text-gray-600">
              <label
                for="churchImages"
                class="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500"
              >
                <span>Upload images</span>
                <input type="file" id="churchImages" name="newImages" accept="image/*" multiple class="sr-only" />
              </label>
              <span class="pl-1">drag and drop, or paste from clipboard</span>
            </p>
            <p class="text-xs text-gray-500 mt-1">PNG, JPG, GIF, WebP up to 10MB each</p>
          </div>
        </div>

        {/* File List */}
        <div id="file-list" class="mt-4 hidden">
          <h5 class="text-sm font-medium text-gray-900 mb-3">Files to upload</h5>
          <ul class="space-y-2"></ul>
        </div>
      </div>

      {/* Hidden input for church ID if editing */}
      {churchId && <input type="hidden" name="churchId" value={churchId} />}

      {/* Script for drag-and-drop and image processing */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
        // Image processing utilities
        async function extractImageDimensions(file) {
          return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = function() {
              const width = this.width;
              const height = this.height;
              URL.revokeObjectURL(objectUrl);
              resolve({ width, height });
            };
            
            img.onerror = function() {
              URL.revokeObjectURL(objectUrl);
              resolve({ width: 800, height: 600 }); // Default dimensions
            };
            
            img.src = objectUrl;
          });
        }
        
        // Initialize drag and drop for reordering
        const sortableContainer = document.getElementById('sortable-images');
        if (sortableContainer) {
          let draggedElement = null;
          
          sortableContainer.addEventListener('dragstart', (e) => {
            if (e.target.getAttribute('draggable') === 'true') {
              draggedElement = e.target;
              e.target.style.opacity = '0.5';
            }
          });
          
          sortableContainer.addEventListener('dragend', (e) => {
            if (e.target.getAttribute('draggable') === 'true') {
              e.target.style.opacity = '';
            }
          });
          
          sortableContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(sortableContainer, e.clientY);
            if (afterElement == null) {
              sortableContainer.appendChild(draggedElement);
            } else {
              sortableContainer.insertBefore(draggedElement, afterElement);
            }
          });
          
          sortableContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            // Update sort order inputs
            const items = sortableContainer.querySelectorAll('[data-image-id]');
            items.forEach((item, index) => {
              const sortInput = item.querySelector('input[name="imageSortOrders"]');
              if (sortInput) sortInput.value = index;
              
              // Update featured/primary indicator
              const primaryLabel = item.querySelector('.absolute');
              if (primaryLabel) {
                primaryLabel.style.display = index === 0 ? 'block' : 'none';
              }
              
              // Update checkbox
              const checkbox = item.querySelector('input[name="imagePrimary"]');
              if (checkbox) {
                checkbox.checked = index === 0;
              }
            });
          });
          
          function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('[draggable="true"]:not([style*="opacity: 0.5"])')];
            
            return draggableElements.reduce((closest, child) => {
              const box = child.getBoundingClientRect();
              const offset = y - box.top - box.height / 2;
              
              if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
              } else {
                return closest;
              }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
          }
        }
        
        // File upload handling
        const fileInput = document.getElementById('churchImages');
        const dropZone = document.getElementById('drop-zone');
        const fileList = document.getElementById('file-list');
        const fileListContainer = fileList?.querySelector('ul');
        
        if (fileInput && dropZone) {
          // File input change
          fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
          });
          
          // Paste handling
          document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            const imageFiles = [];
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                  // Create a new File with a better name
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                  const extension = file.type.split('/')[1] || 'png';
                  const newFile = new File([file], \`pasted-image-\${timestamp}.\${extension}\`, {
                    type: file.type,
                    lastModified: file.lastModified,
                  });
                  imageFiles.push(newFile);
                }
              }
            }
            
            if (imageFiles.length > 0) {
              e.preventDefault();
              
              // Add to existing files
              const dt = new DataTransfer();
              const existingFiles = fileInput.files || [];
              
              // Add existing files
              for (let i = 0; i < existingFiles.length; i++) {
                dt.items.add(existingFiles[i]);
              }
              
              // Add pasted files
              for (const file of imageFiles) {
                dt.items.add(file);
              }
              
              fileInput.files = dt.files;
              handleFiles(dt.files);
              
              // Show feedback
              const feedback = document.createElement('div');
              feedback.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 z-50';
              feedback.textContent = \`\${imageFiles.length} image(s) pasted successfully!\`;
              document.body.appendChild(feedback);
              
              setTimeout(() => {
                feedback.remove();
              }, 3000);
            }
          });
          
          // Drag and drop
          dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-gray-400', 'bg-gray-50');
          });
          
          dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-gray-400', 'bg-gray-50');
          });
          
          dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-gray-400', 'bg-gray-50');
            
            const files = e.dataTransfer.files;
            handleFiles(files);
            
            // Update file input
            const dt = new DataTransfer();
            for (let i = 0; i < files.length; i++) {
              dt.items.add(files[i]);
            }
            fileInput.files = dt.files;
          });
          
          async function handleFiles(files) {
            if (!files || files.length === 0) return;
            
            fileList.classList.remove('hidden');
            fileListContainer.innerHTML = '';
            
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (!file.type.startsWith('image/')) continue;
              
              const dimensions = await extractImageDimensions(file);
              const li = document.createElement('li');
              li.className = 'flex items-center justify-between p-2 border border-gray-200 rounded';
              li.innerHTML = \`
                <div class="flex items-center space-x-2">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-gray-900">\${file.name}</p>
                    <p class="text-xs text-gray-500">\${(file.size / 1024 / 1024).toFixed(2)} MB • \${dimensions.width} × \${dimensions.height}</p>
                  </div>
                </div>
                <button type="button" onclick="removeFile(\${i})" class="text-red-600 hover:text-red-500">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              \`;
              fileListContainer.appendChild(li);
              
              // Store dimensions in data attributes for later use
              li.dataset.width = dimensions.width;
              li.dataset.height = dimensions.height;
            }
          }
        }
        
        window.removeFile = function(index) {
          const dt = new DataTransfer();
          const files = fileInput.files;
          
          for (let i = 0; i < files.length; i++) {
            if (i !== index) dt.items.add(files[i]);
          }
          
          fileInput.files = dt.files;
          handleFiles(dt.files);
          
          if (dt.files.length === 0) {
            fileList.classList.add('hidden');
          }
        };
        `,
        }}
      />
    </div>
  );
};
