'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useApiUpload } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { ApiError, API_ORIGIN } from '@/lib/api';

// WYSIWYG editor for a blog post body. Inline images are inserted as
// absolute URLs (API_ORIGIN + the uploaded path) rather than relative ones,
// because the resulting HTML is stored as-is and later rendered elsewhere
// via dangerouslySetInnerHTML with no chance to rewrite src attributes at
// render time — unlike the separate coverImageUrl field, which every
// renderer already prefixes with API_ORIGIN itself.
export default function BlogEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const upload = useApiUpload();
  const { alertDialog, promptDialog } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiptapImage,
      TiptapLink.configure({ openOnClick: false }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'blog-content min-h-[280px] outline-none px-4 py-3' },
    },
  });

  // TipTap only reads `content` at mount — re-sync if it's replaced from
  // outside (e.g. applying an AI-enhanced suggestion into the editor).
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  async function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const { coverImageUrl } = await upload<{ coverImageUrl: string }>('/uploads/blog-cover', file);
      editor.chain().focus().setImage({ src: `${API_ORIGIN}${coverImageUrl}` }).run();
    } catch (err) {
      await alertDialog(err instanceof ApiError ? err.message : 'Image upload failed — please try again.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!editor) {
    return <div className="input h-64 flex items-center justify-center text-sm text-muted">Loading editor…</div>;
  }

  const btnClass = (active: boolean) =>
    `w-8 h-8 rounded flex items-center justify-center transition-colors ${active ? 'bg-primary text-white' : 'text-ink/70 hover:bg-white'}`;

  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-b border-border bg-ground">
        <button type="button" className={btnClass(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          type="button"
          className={btnClass(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={btnClass(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-1" />
        <button type="button" className={btnClass(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={btnClass(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          type="button"
          className={btnClass(editor.isActive('link'))}
          onClick={async () => {
            const url = await promptDialog('Link URL', '', { placeholder: 'https://', confirmLabel: 'Insert' });
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          aria-label="Insert link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass(false)} onClick={() => fileRef.current?.click()} aria-label="Insert image">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onImagePick} className="hidden" />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
