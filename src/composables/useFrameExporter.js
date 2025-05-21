// src/composables/useFrameExporter.js
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export default function useFrameExporter(
    extractedFramesRef,         // ref([]) - App.vue's list of frame sources (Base64 or asset://)
    projectOriginalFramePathsRef, // ref([]) - App.vue's list of original file paths
    frameEditorRef,             // ref(null) - App.vue's template ref to FrameEditor component
    frameToEditInEditorRef      // ref(null) - App.vue's ref to the frame object currently in FrameEditor
) {
    const isExporting = ref(false);
    const exportError = ref(null);
    const exportSuccessMessage = ref('');

    const generateFileName = (index, totalFrames) => {
        // Simple zero-padding, adjust as needed
        // Ensure totalFrames is at least 1 to avoid issues with String(0).length
        const actualTotalFrames = Math.max(1, totalFrames);
        const numDigits = String(actualTotalFrames -1).length;
        return `frame_${String(index).padStart(numDigits, '0')}.png`;
    };

    const handleExportSelectedFrames = async (startIndex, endIndex, projectName) => {
        if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
            exportError.value = "项目名称无效。";
            isExporting.value = false;
            exportSuccessMessage.value = '';
            return false;
        }
        // Validate frames and paths refs
        if (!extractedFramesRef || !extractedFramesRef.value || !projectOriginalFramePathsRef || !projectOriginalFramePathsRef.value) {
            exportError.value = "内部错误：帧数据引用无效。";
            isExporting.value = false;
            exportSuccessMessage.value = '';
            return false;
        }
        if (startIndex < 0 || endIndex < startIndex || endIndex >= extractedFramesRef.value.length) {
            exportError.value = `无效的帧范围 (${startIndex}-${endIndex})。可用帧数: ${extractedFramesRef.value.length}`;
            isExporting.value = false;
            exportSuccessMessage.value = '';
            return false;
        }

        isExporting.value = true;
        exportError.value = null;
        exportSuccessMessage.value = '';
        const exportItems = [];
        const totalFramesForNaming = extractedFramesRef.value.length;

        try {
            for (let i = startIndex; i <= endIndex; i++) {
                const frameSource = extractedFramesRef.value[i];
                const originalFilePath = projectOriginalFramePathsRef.value[i];
                const fileName = generateFileName(i, totalFramesForNaming);
                let itemToAdd = null;

                if (frameEditorRef && frameEditorRef.value && 
                    frameToEditInEditorRef && frameToEditInEditorRef.value && 
                    frameToEditInEditorRef.value.index === i) {
                    
                    const editorData = frameEditorRef.value.getCanvasDataAsBase64();
                    if (editorData && editorData.startsWith('data:image/png;base64,')) {
                        itemToAdd = { type: 'base64', data: editorData, fileName };
                        // console.log(`Exporting frame ${i} from FrameEditor (active edit) as ${fileName}`);
                    }
                }

                if (!itemToAdd) {
                    if (frameSource && typeof frameSource === 'string') {
                        if (frameSource.startsWith('data:image/png;base64,')) {
                            itemToAdd = { type: 'base64', data: frameSource, fileName };
                            // console.log(`Exporting frame ${i} using existing Base64 as ${fileName}`);
                        } else if (originalFilePath) {
                            itemToAdd = { type: 'filepath', path: originalFilePath, fileName };
                            // console.log(`Exporting frame ${i} using original path ${originalFilePath} as ${fileName}`);
                        }
                    }
                }
                
                if (itemToAdd) {
                    exportItems.push(itemToAdd);
                } else {
                    console.warn(`无法确定帧索引 ${i} (目标文件名: ${fileName}) 的数据源，将跳过此帧。 FrameSource: ${frameSource}, OriginalPath: ${originalFilePath}`);
                }
            }

            if (exportItems.length === 0) {
                if (startIndex <= endIndex) { // If there was a valid range but nothing could be exported
                     exportError.value = "选定范围内没有可导出的帧数据。请检查帧是否已正确处理或编辑。";
                } else {
                     exportError.value = "没有可导出的帧。";
                }
                isExporting.value = false;
                return false;
            }
            
            await invoke('handle_export_frames_to_project', {
                projectName: projectName,
                exportItems: exportItems,
            });
            
            exportSuccessMessage.value = `成功导出 ${exportItems.length} 帧到项目 "${projectName}" 的 outputs 文件夹。`;
            return true;

        } catch (err) {
            console.error("Error during frame export:", err);
            const message = err.message || (typeof err === 'string' ? err : '未知错误');
            exportError.value = `导出失败: ${message}`;
            return false;
        } finally {
            isExporting.value = false;
        }
    };

    return {
        isExporting,
        exportError,
        exportSuccessMessage,
        handleExportSelectedFrames,
    };
} 