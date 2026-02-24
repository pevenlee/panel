import React, { useState, useCallback, useRef } from 'react';
import { Upload, GripVertical, Trash2, Plus, FolderOpen, X } from 'lucide-react';
import { pptApi } from '../services/api';
import { message } from 'antd';

const CHAPTER_ID_PREFIX = 'chapter-';
const generateId = () => CHAPTER_ID_PREFIX + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

/** 默认章节名 */
const defaultChapterTitle = (index) => (index === 0 ? '默认章节' : `章节 ${index + 1}`);

export default function PptSlideEditor() {
  const [slides, setSlides] = useState([]); // 来自上传：{ id, index, title, text }
  const [chapters, setChapters] = useState([]); // { id, title, slideIds: string[] }
  const [uploading, setUploading] = useState(false);
  const [dragSlideId, setDragSlideId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { chapterId, index } 或 { chapterId } 表示放到章节末尾
  const fileInputRef = useRef(null);

  const handleUpload = useCallback(async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pptx') && !file.name.toLowerCase().endsWith('.ppt')) {
      message.warning('请选择 .pptx 或 .ppt 文件');
      return;
    }
    setUploading(true);
    try {
      const res = await pptApi.parsePpt(file);
      if (!res?.success || !Array.isArray(res.slides)) {
        throw new Error(res?.detail || '解析失败');
      }
      const list = res.slides.map((s) => ({
        id: s.id,
        index: s.index,
        title: s.title || `幻灯片 ${s.index + 1}`,
        text: s.text || ''
      }));
      setSlides(list);
      const slideIds = list.map((s) => s.id);
      setChapters([{ id: generateId(), title: defaultChapterTitle(0), slideIds }]);
      message.success(`已解析 ${list.length} 张幻灯片`);
    } catch (err) {
      message.error(err?.response?.data?.detail || err?.message || '上传解析失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const addChapter = useCallback(() => {
    setChapters((prev) => [
      ...prev,
      { id: generateId(), title: defaultChapterTitle(prev.length), slideIds: [] }
    ]);
  }, []);

  const deleteChapter = useCallback((chapterId) => {
    setChapters((prev) => {
      const list = prev.filter((c) => c.id !== chapterId);
      const removed = prev.find((c) => c.id === chapterId);
      if (removed?.slideIds?.length && list.length > 0) {
        const first = list[0];
        const firstIdx = prev.findIndex((c) => c.id === first.id);
        const next = [...list];
        next[firstIdx] = {
          ...first,
          slideIds: [...(first.slideIds || []), ...removed.slideIds]
        };
        return next;
      }
      return list;
    });
  }, []);

  const updateChapterTitle = useCallback((chapterId, title) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, title: title || c.title } : c))
    );
  }, []);

  const deleteSlide = useCallback((slideId, chapterId) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.id === chapterId
          ? { ...c, slideIds: (c.slideIds || []).filter((id) => id !== slideId) }
          : c
      )
    );
  }, []);

  const moveSlide = useCallback(
    (slideId, fromChapterId, toChapterId, toIndex) => {
      if (fromChapterId === toChapterId) {
        setChapters((prev) =>
          prev.map((c) => {
            if (c.id !== fromChapterId) return c;
            const ids = [...(c.slideIds || [])];
            const fromIdx = ids.indexOf(slideId);
            if (fromIdx === -1) return c;
            ids.splice(fromIdx, 1);
            const insertAt =
              toIndex == null
                ? ids.length
                : Math.min(toIndex > fromIdx ? toIndex - 1 : toIndex, ids.length);
            ids.splice(insertAt, 0, slideId);
            return { ...c, slideIds: ids };
          })
        );
      } else {
        setChapters((prev) => {
          let moved = null;
          const next = prev.map((c) => {
            if (c.id === fromChapterId) {
              const ids = (c.slideIds || []).filter((id) => id !== slideId);
              return { ...c, slideIds: ids };
            }
            if (c.id === toChapterId) {
              const ids = [...(c.slideIds || [])];
              const insertAt = toIndex == null ? ids.length : Math.min(toIndex, ids.length);
              ids.splice(insertAt, 0, slideId);
              return { ...c, slideIds: ids };
            }
            return c;
          });
          return next;
        });
      }
    },
    []
  );

  const onDragStart = (e, slideId, chapterId) => {
    setDragSlideId(slideId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ slideId, chapterId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setDragSlideId(null);
    setDropTarget(null);
  };

  const onDragOver = (e, chapterId, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ chapterId, index });
  };

  const onDragLeave = () => {
    setDropTarget(null);
  };

  const onDrop = (e, toChapterId, toIndex) => {
    e.preventDefault();
    setDropTarget(null);
    try {
      const raw = e.dataTransfer.getData('text/plain');
      const { slideId, chapterId: fromChapterId } = JSON.parse(raw);
      if (slideId && fromChapterId) moveSlide(slideId, fromChapterId, toChapterId, toIndex);
    } catch (_) {}
    setDragSlideId(null);
  };

  const slideMap = Object.fromEntries((slides || []).map((s) => [s.id, s]));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* 上传区 */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ppt,.pptx"
          className="hidden"
          onChange={handleUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? '解析中…' : '上传 PPT'}
        </button>
        <span className="ml-3 text-slate-500 text-sm">
          上传后可在左侧调整幻灯片顺序、拖入不同章节；章节可增删，幻灯片可删除不可新增。
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* 左侧：章节 + 幻灯片列表 */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
          {chapters.length === 0 && (
            <div className="p-6 text-center text-slate-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>请先上传 PPT</p>
            </div>
          )}
          {chapters.map((chapter) => (
            <div key={chapter.id} className="border-b border-slate-100">
              {/* 章节标题行：可拖入、可删除章节 */}
              <div
                className={`flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200 ${
                  dropTarget?.chapterId === chapter.id && dropTarget?.index == null
                    ? 'ring-2 ring-blue-400'
                    : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTarget({ chapterId: chapter.id, index: null });
                }}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, chapter.id, null)}
              >
                <FolderOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none py-0.5 text-sm font-medium text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => deleteChapter(chapter.id)}
                  className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                  title="删除章节"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* 该章节下的幻灯片 */}
              <div className="py-1">
                {(chapter.slideIds || []).map((sid, idx) => {
                  const slide = slideMap[sid];
                  if (!slide) return null;
                  const isDropHere =
                    dropTarget?.chapterId === chapter.id && dropTarget?.index === idx;
                  return (
                    <div
                      key={sid}
                      className={`flex items-center gap-2 px-3 py-1.5 group ${
                        isDropHere ? 'bg-blue-50' : ''
                      } ${dragSlideId === sid ? 'opacity-50' : ''}`}
                      onDragOver={(e) => onDragOver(e, chapter.id, idx)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, chapter.id, idx)}
                    >
                      <span
                        draggable
                        onDragStart={(e) => onDragStart(e, sid, chapter.id)}
                        onDragEnd={onDragEnd}
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-700" title={slide.title}>
                        {slide.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSlide(sid, chapter.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-600"
                        title="删除幻灯片"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {chapters.length > 0 && (
            <button
              type="button"
              onClick={addChapter}
              className="m-3 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 text-sm"
            >
              <Plus className="w-4 h-4" />
              新增章节
            </button>
          )}
        </div>

        {/* 右侧：占位说明 */}
        <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
          {slides.length > 0 ? (
            <p className="text-sm">
              共 {slides.length} 张幻灯片，{chapters.length} 个章节。在左侧拖拽可调整顺序或移动到不同章节。
            </p>
          ) : (
            <p className="text-sm">上传 PPT 后在此查看统计与预览（可按需扩展）</p>
          )}
        </div>
      </div>
    </div>
  );
}
