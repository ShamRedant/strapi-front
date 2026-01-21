"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, GraduationCap, Home, PlayCircle, ExternalLink, ChevronRight, Download, CheckCircle, ArrowLeft, File, Presentation, Search, X, Menu, ChevronDown } from "lucide-react";
// import SecurePdfViewer from "./components/SecurePDFViewer";

import dynamic from "next/dynamic";

const SecurePDFViewer = dynamic(
  () => import("./components/SecurePDFViewer"),
  { ssr: false }
);



const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://3.6.27.148/strapi";
// Your production app is served under http://3.6.27.148/strapi-front
// so API routes must be called as /strapi-front/api/...
// (This avoids needing env vars on the server.)
const HARDCODED_APP_BASE_PATH = "/strapi-front";

const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "") || "/";

const detectBasePath = () => {
  // If running under /strapi-front/... keep that prefix for API calls
  // Fallback: use the hardcoded value if present.
  try {
    const path = window.location.pathname || "/";
    if (path.startsWith("/strapi-front")) return "/strapi-front";
  } catch {}
  return HARDCODED_APP_BASE_PATH || "";
};

const buildMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  try {
    return new URL(url, STRAPI_URL).toString();
  } catch {
    return url;
  }
};

const getAttrs = (entity = {}) => entity.attributes ?? entity ?? {};

const normalizeFile = (file) => {
  if (!file) return null;
  const attrs = getAttrs(file);
  return {
    id: file.id ?? attrs.id,
    name: attrs.name ?? "File",
    url: buildMediaUrl(attrs.url),
    ext: attrs.ext ?? "",
    mime: attrs.mime ?? "",
  };
};

const normalizeLesson = (lesson) => {
  const attrs = getAttrs(lesson);
  const files = Array.isArray(attrs.ppt_file)
    ? attrs.ppt_file.map(normalizeFile).filter(Boolean)
    : [];

  return {
    id: lesson.id ?? attrs.id,
    title: attrs.title ?? "Untitled lesson",
    description: attrs.description ?? attrs.short_description ?? "",
    order: attrs.order ?? 0,
    studentFile: normalizeFile(attrs.student_file),
    teacherFile: normalizeFile(attrs.teacher_file),
    homeworkFile: normalizeFile(attrs.homework_file),
    pptFiles: files,
    quizLink: attrs.quizz_links ?? "",
  };
};

const normalizeModule = (module) => {
  const attrs = getAttrs(module);
  const lessons = Array.isArray(attrs.lessons)
    ? attrs.lessons.map(normalizeLesson)
    : [];

  return {
    id: module.id ?? attrs.id,
    documentId: attrs.documentId,
    title: attrs.title ?? "Untitled module",
    order: attrs.order ?? 0,
    lessons,
  };
};

const normalizeCourse = (course) => {
  const attrs = getAttrs(course);
  const modules = Array.isArray(attrs.modules)
    ? attrs.modules.map(normalizeModule).sort((a, b) => a.order - b.order)
    : [];

  return {
    id: course.id ?? attrs.id,
    title: attrs.course_title ?? "Untitled course",
    slug: attrs.slug ?? "",
    modules,
  };
};

async function fetchFromStrapi(path, params = {}) {
  try {
    // Use proxy route to handle CORS issues
    const basePath = detectBasePath();
    const proxyPath = joinPath(basePath, "api/strapi-proxy");
    const proxyUrl = new URL(proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`, window.location.origin);
    proxyUrl.searchParams.append('path', path);
    
    // Add all params to proxy URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        proxyUrl.searchParams.append(key, value);
      }
    });

    console.log(`[Client] Fetching via proxy: ${proxyUrl.toString()}`);

    const res = await fetch(proxyUrl.toString(), { 
      cache: "no-store",
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`[Client] Proxy response status: ${res.status}`);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[Client] Proxy error response:', errorData);
      const errorMsg = errorData.error || errorData.details || `Failed to fetch ${path}: ${res.status} ${res.statusText}`;
      throw new Error(`${errorMsg}${errorData.url ? ` (URL: ${errorData.url})` : ''}`);
    }
    
    const json = await res.json();
    console.log(`[Client] Success: ${path}`);
    return json?.data ?? [];
  } catch (error) {
    console.error('[Client] Fetch error:', error);
    console.error('[Client] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Provide more specific error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(`Network error: Cannot connect to API proxy at ${window.location.origin}/api/strapi-proxy. Check server logs for details.`);
    }
    throw error;
  }
}

const FileViewer = ({ file, allowDownload = false }) => {
  if (!file) return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="text-center">
        <FileText className="mx-auto h-20 w-20 text-slate-300" />
        <p className="mt-4 text-base font-semibold text-slate-600">No document selected</p>
        <p className="mt-1 text-sm text-slate-400">Select a file from the materials list</p>
      </div>
    </div>
  );

  const isPDF = file.mime === "application/pdf" || file.ext === ".pdf";
  const isVideo = file.mime?.startsWith("video/");
  const basePath = (() => {
    try {
      return detectBasePath();
    } catch {
      return HARDCODED_APP_BASE_PATH || "";
    }
  })();
  const proxiedUrl = `${joinPath(basePath, "api/proxy-file")}?url=${encodeURIComponent(file.url)}`;

  const handleContextMenu = (e) => {
    if (!allowDownload) {
      e.preventDefault();
      return false;
    }
  };

  const handleKeyDown = (e) => {
    if (!allowDownload) {
      // Prevent Ctrl+S (Save)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent Ctrl+P (Print)
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent Ctrl+C (Copy)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.getSelection()?.removeAllRanges();
        return false;
      }
      // Prevent Ctrl+A (Select All)
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.getSelection()?.removeAllRanges();
        return false;
      }
      // Prevent Ctrl+X (Cut)
      if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent Ctrl+V (Paste)
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Prevent F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent PrintScreen
      if (e.key === 'PrintScreen' || e.keyCode === 44 || e.key === 'F13') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      // Prevent Windows/Meta key combinations
      if (e.metaKey || (e.ctrlKey && e.shiftKey && e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  };

  const handleCopy = (e) => {
    if (!allowDownload) {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
      e.clipboardData?.clearData();
      window.getSelection()?.removeAllRanges();
      return false;
    }
  };

  const handleCut = (e) => {
    if (!allowDownload) {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
      e.clipboardData?.clearData();
      return false;
    }
  };

  const handleSelect = (e) => {
    if (!allowDownload) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      return false;
    }
  };

  const handleMouseUp = (e) => {
    if (!allowDownload) {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleDragStart = (e) => {
    if (!allowDownload) {
      e.preventDefault();
      return false;
    }
  };

  if (isVideo) {
    return (
      <div 
        className="h-full bg-black select-none"
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyDown}
        onCopy={handleCopy}
        onCut={handleCut}
        onSelect={handleSelect}
        onMouseUp={handleMouseUp}
        onDragStart={handleDragStart}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      >
        <video
          controls
          controlsList={allowDownload ? undefined : "nodownload nofullscreen noremoteplayback"}
          className="h-full w-full pointer-events-auto"
          src={file.url}
          preload="metadata"
          onContextMenu={handleContextMenu}
          onCopy={handleCopy}
          onCut={handleCut}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }


  if (isPDF) {
    return (
      <div className="flex h-full flex-col gap-3">
        {/* <iframe
          title={file.name}
          src={`${proxiedUrl}#toolbar=0&navpanes=0`}
          className="flex-1 rounded-lg border border-slate-200 bg-white"
        /> */}
        
        <SecurePDFViewer
          url={proxiedUrl}
          // watermark={`santhosh.kumar • ${new Date().toLocaleString()}`}
          className="flex-1 rounded-lg border border-slate-200 bg-white"
          highlightText="robot"
        />
        {/* <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <ExternalLink className="h-4 w-4" />
          Open in New Tab
        </a> */}
        
      </div>
    );
  }

  // Other file types (images, docs, etc.)
  if (allowDownload) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          download
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 font-medium text-white transition hover:from-blue-600 hover:to-indigo-600 shadow-md"
        >
          <Download className="h-5 w-5" />
          Download {file.name}
        </a>
      </div>
    );
  }

  // Non-downloadable files
  return (
    <div 
      className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30 select-none"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onSelect={handleSelect}
      onDragStart={handleDragStart}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <div className="text-center">
        <FileText className="mx-auto h-16 w-16 text-slate-300" />
        <p className="mt-4 text-base font-semibold text-slate-700">{file.name}</p>
        <p className="mt-2 text-sm text-slate-500">This file is for viewing only</p>
        <p className="mt-1 text-xs text-slate-400">Download is not permitted for this file type</p>
      </div>
    </div>
  );
};

export default function LMSApp() {
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoadingCourses(true);
        setError("");
        const data = await fetchFromStrapi("courses", {
          populate: "*",
          sort: "createdAt:asc",
        });
        setCourses(data.map(normalizeCourse));
        if (data[0]) {
          const firstCourse = normalizeCourse(data[0]);
          setActiveCourseId(firstCourse.id);
          if (firstCourse.modules[0]) {
            setActiveModuleId(firstCourse.modules[0].id);
            if (firstCourse.modules[0].lessons?.length) {
              setLessonsByModule((prev) => ({
                ...prev,
                [firstCourse.modules[0].id]: firstCourse.modules[0].lessons,
              }));
            }
          }
        }
      } catch (err) {
        setError(err.message || "Unable to load courses");
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

  const fetchLessonsForModule = async (moduleId, moduleDocumentId) => {
    try {
      setLoadingLessons(true);
      setError("");
      let lessons = await fetchFromStrapi("lessons", {
        populate: "*",
        "filters[module][id][$eq]": moduleId,
        sort: "createdAt:asc",
      });

      if (!lessons.length && moduleDocumentId) {
        lessons = await fetchFromStrapi("lessons", {
          populate: "*",
          "filters[module][documentId][$eq]": moduleDocumentId,
          sort: "createdAt:asc",
        });
      }

      setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons.map(normalizeLesson) }));
    } catch (err) {
      setError(err.message || "Unable to load lessons");
    } finally {
      setLoadingLessons(false);
    }
  };

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === activeCourseId),
    [courses, activeCourseId]
  );

  const activeModule = useMemo(
    () => activeCourse?.modules?.find((m) => m.id === activeModuleId),
    [activeCourse, activeModuleId]
  );

  const handleModuleSelect = async (moduleId) => {
    setActiveModuleId(moduleId);
    setSelectedLesson(null);
    setSelectedDocument(null);
    setSidebarOpen(false);
    if (lessonsByModule[moduleId]?.length) return;

    const moduleMeta = activeCourse?.modules?.find((m) => m.id === moduleId);
    const moduleDocumentId = moduleMeta?.documentId;
    await fetchLessonsForModule(moduleId, moduleDocumentId);
  };

  useEffect(() => {
    if (!activeCourse) return;
    const firstModule = activeCourse.modules?.[0];
    if (!firstModule) {
      setActiveModuleId(null);
      setSelectedLesson(null);
      setSelectedDocument(null);
      return;
    }

    setActiveModuleId(firstModule.id);
    setSelectedLesson(null);
    setSelectedDocument(null);

    if (!lessonsByModule[firstModule.id]) {
      fetchLessonsForModule(firstModule.id, firstModule.documentId);
    }
  }, [activeCourse]);

  const activeLessons = activeModuleId ? lessonsByModule[activeModuleId] ?? [] : [];

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    courses.forEach((course) => {
      if (course.title.toLowerCase().includes(query)) {
        results.push({
          type: "course",
          id: course.id,
          title: course.title,
          courseId: course.id,
          courseName: course.title,
        });
      }

      course.modules.forEach((module) => {
        if (module.title.toLowerCase().includes(query)) {
          results.push({
            type: "module",
            id: module.id,
            title: module.title,
            courseId: course.id,
            courseName: course.title,
            moduleId: module.id,
          });
        }

        const moduleLessons = lessonsByModule[module.id] || [];
        moduleLessons.forEach((lesson) => {
          const matchesTitle = lesson.title.toLowerCase().includes(query);
          const matchesDescription = lesson.description?.toLowerCase().includes(query);

          if (matchesTitle || matchesDescription) {
            results.push({
              type: "lesson",
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              courseId: course.id,
              courseName: course.title,
              moduleId: module.id,
              moduleName: module.title,
              lesson: lesson,
            });
          }
        });
      });
    });

    setSearchResults(results);
  }, [searchQuery, courses, lessonsByModule]);

  const handleLessonClick = (lesson) => {
    setSelectedLesson(lesson);
    const docs = getDocuments(lesson);
    setSelectedDocument(docs[0] || null);
    setSearchQuery("");
    setSearchResults([]);
    setSidebarOpen(false);
  };

  const handleBackToLessons = () => {
    setSelectedLesson(null);
    setSelectedDocument(null);
  };

  const handleSearchResultClick = async (result) => {
    setActiveCourseId(result.courseId);
    
    if (result.type === "course") {
      setActiveModuleId(null);
      setSelectedLesson(null);
    } else if (result.type === "module") {
      setActiveModuleId(result.moduleId);
      setSelectedLesson(null);
      if (!lessonsByModule[result.moduleId]) {
        const moduleMeta = courses
          .find((c) => c.id === result.courseId)
          ?.modules?.find((m) => m.id === result.moduleId);
        if (moduleMeta) {
          await fetchLessonsForModule(result.moduleId, moduleMeta.documentId);
        }
      }
    } else if (result.type === "lesson") {
      setActiveModuleId(result.moduleId);
      if (!lessonsByModule[result.moduleId]) {
        const moduleMeta = courses
          .find((c) => c.id === result.courseId)
          ?.modules?.find((m) => m.id === result.moduleId);
        if (moduleMeta) {
          await fetchLessonsForModule(result.moduleId, moduleMeta.documentId);
        }
      }
      handleLessonClick(result.lesson);
    }
    
    setSearchQuery("");
    setSearchResults([]);
  };

  const getDocuments = (lesson) => {
    if (!lesson) return [];
    const docs = [];
    
    if (lesson.studentFile) {
      docs.push({ ...lesson.studentFile, uniqueKey: `student-${lesson.id}`, type: "Student File", icon: FileText, color: "blue" });
    }
    if (lesson.teacherFile) {
      docs.push({ ...lesson.teacherFile, uniqueKey: `teacher-${lesson.id}`, type: "Teacher Guide", icon: GraduationCap, color: "purple" });
    }
    if (lesson.homeworkFile) {
      docs.push({ ...lesson.homeworkFile, uniqueKey: `homework-${lesson.id}`, type: "Homework", icon: BookOpen, color: "orange" });
    }
    if (lesson.pptFiles?.length) {
      lesson.pptFiles.forEach((file, idx) => {
        docs.push({ ...file, uniqueKey: `ppt-${lesson.id}-${idx}`, type: `Presentation ${idx + 1}`, icon: Presentation, color: "green" });
      });
    }
    if (lesson.quizLink) {
      docs.push({ 
        id: "quiz", 
        uniqueKey: `quiz-${lesson.id}`,
        name: "Quiz", 
        url: lesson.quizLink, 
        type: "Quiz Link", 
        icon: CheckCircle, 
        color: "emerald",
        isLink: true 
      });
    }
    
    return docs;
  };

  const documents = getDocuments(selectedLesson);

  // Global protection for non-homework files
  useEffect(() => {
    const isHomeworkFile = selectedDocument?.uniqueKey?.startsWith('homework-');
    const allowDownload = isHomeworkFile || !selectedDocument;

    // Prevent right-click context menu
    const handleContextMenu = (e) => {
      if (!allowDownload) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // Comprehensive keyboard shortcut prevention
    const handleKeyDown = (e) => {
      if (!allowDownload) {
        // Prevent Ctrl+S (Save)
        if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent Ctrl+P (Print)
        if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent Ctrl+C (Copy)
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          window.getSelection()?.removeAllRanges();
          return false;
        }
        // Prevent Ctrl+A (Select All)
        if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          window.getSelection()?.removeAllRanges();
          return false;
        }
        // Prevent Ctrl+X (Cut)
        if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent Ctrl+V (Paste)
        if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Prevent F12 (Developer Tools)
        if (e.key === 'F12') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent PrintScreen (F13 or specific key codes)
        if (e.key === 'PrintScreen' || e.keyCode === 44 || e.key === 'F13') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        // Prevent Windows key combinations
        if (e.metaKey || (e.ctrlKey && e.shiftKey && e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    // Prevent copy via clipboard API
    const handleCopy = (e) => {
      if (!allowDownload) {
        e.preventDefault();
        e.clipboardData?.setData('text/plain', '');
        e.clipboardData?.clearData();
        window.getSelection()?.removeAllRanges();
        return false;
      }
    };

    // Prevent text selection
    const handleSelect = (e) => {
      if (!allowDownload) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        return false;
      }
    };

    const handleSelectStart = (e) => {
      if (!allowDownload) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        return false;
      }
    };

    const handleMouseUp = (e) => {
      if (!allowDownload) {
        window.getSelection()?.removeAllRanges();
      }
    };

    // Prevent drag
    const handleDragStart = (e) => {
      if (!allowDownload) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Add event listeners with capture phase
    if (!allowDownload) {
      // Use capture phase (true) to catch events early
      document.addEventListener('contextmenu', handleContextMenu, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyDown, true);
      document.addEventListener('copy', handleCopy, true);
      document.addEventListener('cut', handleCopy, true);
      document.addEventListener('select', handleSelect, true);
      document.addEventListener('selectstart', handleSelectStart, true);
      document.addEventListener('mouseup', handleMouseUp, true);
      document.addEventListener('dragstart', handleDragStart, true);
      
      // Disable text selection via CSS
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.webkitTouchCallout = 'none';
      document.body.style.MozUserSelect = 'none';
      document.body.style.msUserSelect = 'none';
      
      // Add CSS to prevent screenshots (limited effectiveness)
      const style = document.createElement('style');
      style.id = 'prevent-copy-style';
      style.textContent = `
        * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        iframe, video {
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      // Re-enable if homework file or no file selected
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.webkitTouchCallout = '';
      document.body.style.MozUserSelect = '';
      document.body.style.msUserSelect = '';
      
      // Remove protection styles
      const style = document.getElementById('prevent-copy-style');
      if (style) {
        style.remove();
      }
    }

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyDown, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCopy, true);
      document.removeEventListener('select', handleSelect, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.webkitTouchCallout = '';
      document.body.style.MozUserSelect = '';
      document.body.style.msUserSelect = '';
      
      const style = document.getElementById('prevent-copy-style');
      if (style) {
        style.remove();
      }
    };
  }, [selectedDocument]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-sm transition-transform duration-300 lg:static lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200/60 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 p-2 shadow-sm">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-base font-bold text-slate-800">Steps Robotics</h1>
                <p className="text-xs text-slate-500">Learning Platform</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2 px-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Courses</h2>
            </div>

            {loadingCourses && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100/60" />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200/60 bg-red-50/80 p-3 shadow-sm">
                <p className="text-xs font-semibold text-red-800">Error</p>
                <p className="mt-1 text-xs text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              {courses.map((course) => {
                const isActiveCourse = activeCourseId === course.id;
                return (
                  <div
                    key={course.id}
                    className={`overflow-hidden rounded-lg border transition-all ${
                      isActiveCourse
                        ? "border-blue-300 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 shadow-sm"
                        : "border-slate-200/60 bg-white/80 hover:bg-slate-50/80 hover:border-slate-300"
                    }`}
                  >
                    <button
                      onClick={() => setActiveCourseId(course.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                    >
                      <div className={`rounded-md p-1.5 transition-all ${
                        isActiveCourse 
                          ? "bg-gradient-to-br from-blue-400 to-indigo-500 shadow-sm" 
                          : "bg-slate-100/80"
                      }`}>
                        <BookOpen className={`h-3.5 w-3.5 ${isActiveCourse ? "text-white" : "text-slate-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isActiveCourse ? "text-slate-800" : "text-slate-700"}`}>
                          {course.title}
                        </p>
                        <p className="text-xs text-slate-500">{course.modules.length} modules</p>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isActiveCourse ? "rotate-180 text-blue-500" : "text-slate-400"}`} />
                    </button>

                    {isActiveCourse && (
                      <div className="border-t border-blue-100/60 bg-white/50 p-1.5">
                        {course.modules.map((module) => {
                          const isActiveModule = activeModuleId === module.id;
                          return (
                            <button
                              key={module.id}
                              onClick={() => handleModuleSelect(module.id)}
                              className={`mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-all ${
                                isActiveModule
                                  ? "bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-sm"
                                  : "text-slate-600 hover:bg-blue-50/50"
                              }`}
                            >
                              {isActiveModule && <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                              <span className="flex-1 truncate text-xs font-medium">{module.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100/80 transition"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses, modules, lessons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200/60 bg-white/80 py-2 pl-10 pr-10 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300/40 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100/80 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto rounded-lg border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-xl">
                  {searchResults.map((result, idx) => {
                    const icons = { course: BookOpen, module: FileText, lesson: PlayCircle };
                    const Icon = icons[result.type];
                    return (
                      <button
                        key={`${result.type}-${result.id}-${idx}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="flex w-full items-start gap-3 border-b border-slate-100/60 p-3 text-left hover:bg-blue-50/50 transition last:border-0"
                      >
                        <div className="mt-0.5 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 p-2">
                          <Icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {result.type}
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-700">{result.title}</p>
                          </div>
                          {result.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{result.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
              <Home className="h-4 w-4 text-slate-400" />
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="font-medium text-slate-700">{activeCourse?.title || "Courses"}</span>
              {activeModule && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <span className="font-medium text-slate-700">{activeModule.title}</span>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {!selectedLesson ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeModule?.title || "Select a Module"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {activeModule ? "Choose a lesson to view materials" : "Select a module from the sidebar"}
                </p>
              </div>

              {loadingLessons && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-100/60" />
                  ))}
                </div>
              )}

              {!loadingLessons && activeLessons.length === 0 && activeModuleId && (
                <div className="rounded-lg border-2 border-dashed border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-blue-50/40 p-12 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-700">No lessons available</p>
                  <p className="mt-1 text-sm text-slate-500">This module doesn't have any lessons yet</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => handleLessonClick(lesson)}
                    className="group rounded-lg border border-slate-200/60 bg-white/80 backdrop-blur-sm p-4 text-left transition-all hover:border-blue-300 hover:bg-white hover:shadow-md hover:shadow-blue-100/50"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 px-2.5 py-1 text-xs font-bold text-blue-700 shadow-sm">
                        Lesson {lesson.order}
                      </span>
                      <PlayCircle className="h-5 w-5 text-slate-400 transition-colors group-hover:text-blue-500" />
                    </div>
                    <h3 className="mb-2 font-bold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition">
                      {lesson.title}
                    </h3>
                    {lesson.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{lesson.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="w-80 flex-shrink-0 border-r border-slate-200/60 bg-white/80 backdrop-blur-sm overflow-y-auto shadow-sm">
                <div className="p-4">
                  <button
                    onClick={handleBackToLessons}
                    className="mb-4 flex items-center gap-2 rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/80 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Lessons
                  </button>

                  <div className="mb-4">
                    <h2 className="font-bold text-slate-800 line-clamp-2">{selectedLesson.title}</h2>
                    {selectedLesson.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-3">{selectedLesson.description}</p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Course Materials</h3>
                    
                    {documents.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-blue-50/40 p-6 text-center">
                        <File className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-2 text-xs font-medium text-slate-500">No materials</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => {
                          const Icon = doc.icon;
                          const isSelected = selectedDocument?.uniqueKey === doc.uniqueKey;
                          
                          const colorClasses = {
                            blue: {
                              bg: "bg-blue-50/80",
                              border: "border-blue-200/60",
                              hover: "hover:bg-blue-100/80",
                              selected: "border-blue-400 bg-blue-100/90 shadow-sm",
                              icon: isSelected ? "bg-gradient-to-br from-blue-400 to-blue-500" : "bg-blue-100/80",
                              iconColor: isSelected ? "text-white" : "text-blue-600",
                              text: isSelected ? "text-blue-900" : "text-slate-800",
                              subtext: isSelected ? "text-blue-700" : "text-slate-600",
                              check: "text-blue-500"
                            },
                            purple: {
                              bg: "bg-purple-50/80",
                              border: "border-purple-200/60",
                              hover: "hover:bg-purple-100/80",
                              selected: "border-purple-400 bg-purple-100/90 shadow-sm",
                              icon: isSelected ? "bg-gradient-to-br from-purple-400 to-purple-500" : "bg-purple-100/80",
                              iconColor: isSelected ? "text-white" : "text-purple-600",
                              text: isSelected ? "text-purple-900" : "text-slate-800",
                              subtext: isSelected ? "text-purple-700" : "text-slate-600",
                              check: "text-purple-500"
                            },
                            orange: {
                              bg: "bg-orange-50/80",
                              border: "border-orange-200/60",
                              hover: "hover:bg-orange-100/80",
                              selected: "border-orange-400 bg-orange-100/90 shadow-sm",
                              icon: isSelected ? "bg-gradient-to-br from-orange-400 to-orange-500" : "bg-orange-100/80",
                              iconColor: isSelected ? "text-white" : "text-orange-600",
                              text: isSelected ? "text-orange-900" : "text-slate-800",
                              subtext: isSelected ? "text-orange-700" : "text-slate-600",
                              check: "text-orange-500"
                            },
                            green: {
                              bg: "bg-green-50/80",
                              border: "border-green-200/60",
                              hover: "hover:bg-green-100/80",
                              selected: "border-green-400 bg-green-100/90 shadow-sm",
                              icon: isSelected ? "bg-gradient-to-br from-green-400 to-green-500" : "bg-green-100/80",
                              iconColor: isSelected ? "text-white" : "text-green-600",
                              text: isSelected ? "text-green-900" : "text-slate-800",
                              subtext: isSelected ? "text-green-700" : "text-slate-600",
                              check: "text-green-500"
                            },
                            emerald: {
                              bg: "bg-emerald-50/80",
                              border: "border-emerald-200/60",
                              hover: "hover:bg-emerald-100/80",
                              selected: "border-emerald-400 bg-emerald-100/90 shadow-sm",
                              icon: isSelected ? "bg-gradient-to-br from-emerald-400 to-emerald-500" : "bg-emerald-100/80",
                              iconColor: isSelected ? "text-white" : "text-emerald-600",
                              text: isSelected ? "text-emerald-900" : "text-slate-800",
                              subtext: isSelected ? "text-emerald-700" : "text-slate-600",
                              check: "text-emerald-500"
                            }
                          };
                          
                          const colors = colorClasses[doc.color] || colorClasses.blue;
                          
                          if (doc.isLink) {
                            return (
                              <a
                                key={doc.uniqueKey}
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-3 rounded-lg border ${colors.border} ${colors.bg} p-3 transition ${colors.hover} shadow-sm`}
                              >
                                <div className={`rounded-md ${colors.icon} p-2`}>
                                  <Icon className={`h-4 w-4 ${colors.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold ${colors.text}`}>{doc.type}</p>
                                  <p className={`text-xs ${colors.subtext}`}>External link</p>
                                </div>
                                <ExternalLink className={`h-4 w-4 ${colors.check}`} />
                              </a>
                            );
                          }

                          return (
                            <button
                              key={doc.uniqueKey}
                              onClick={() => setSelectedDocument(doc)}
                              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                                isSelected 
                                  ? colors.selected
                                  : `${colors.border} ${colors.bg} ${colors.hover}`
                              }`}
                            >
                              <div className={`rounded-md ${colors.icon} p-2 shadow-sm`}>
                                <Icon className={`h-4 w-4 ${colors.iconColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${colors.text}`}>
                                  {doc.type}
                                </p>
                                <p className={`truncate text-xs ${colors.subtext}`}>
                                  {doc.name}
                                </p>
                              </div>
                              {isSelected && <CheckCircle className={`h-4 w-4 ${colors.check}`} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
                <FileViewer 
                  file={selectedDocument} 
                  allowDownload={selectedDocument?.uniqueKey?.startsWith('homework-') || false}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
