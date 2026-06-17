import {
  Component,
  ElementRef,
  forwardRef,
  Input,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  template: `
    <div class="rte">
      <div class="rte-toolbar" role="toolbar" aria-label="Formato de texto">
        <button type="button" class="rte-btn" title="Negrita" (mousedown)="runCmd($event, 'bold')"><strong>B</strong></button>
        <button type="button" class="rte-btn" title="Cursiva" (mousedown)="runCmd($event, 'italic')"><em>I</em></button>
        <button type="button" class="rte-btn" title="Subrayado" (mousedown)="runCmd($event, 'underline')"><u>S</u></button>
        <span class="rte-sep" aria-hidden="true"></span>
        <button type="button" class="rte-btn" title="Lista con viñetas" (mousedown)="runCmd($event, 'insertUnorderedList')">• Lista</button>
        <button type="button" class="rte-btn" title="Lista numerada" (mousedown)="runCmd($event, 'insertOrderedList')">1. Lista</button>
        <span class="rte-sep" aria-hidden="true"></span>
        <button type="button" class="rte-btn" title="Quitar formato" (mousedown)="runCmd($event, 'removeFormat')">Tx</button>
      </div>
      <div
        #editor
        class="rte-editor"
        contenteditable="true"
        [attr.data-placeholder]="placeholder"
        (input)="onInput()"
        (blur)="onTouched()"
        (paste)="onPaste($event)"
      ></div>
    </div>
  `,
  styles: [`
    .rte {
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }

    .rte-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding: 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      background: #f7f7f7;
    }

    .rte-btn {
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: #fff;
      color: #222;
      border-radius: 6px;
      padding: 5px 10px;
      font-family: var(--f-ui, system-ui, sans-serif);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    .rte-btn:hover {
      background: #eee;
      border-color: rgba(0, 0, 0, 0.18);
    }

    .rte-sep {
      width: 1px;
      height: 22px;
      background: rgba(0, 0, 0, 0.12);
      margin: 0 2px;
    }

    .rte-editor {
      min-height: 110px;
      max-height: 280px;
      overflow-y: auto;
      padding: 12px 14px;
      font-family: var(--f-ui, system-ui, sans-serif);
      font-size: 14px;
      line-height: 1.55;
      color: #111;
      outline: none;
    }

    .rte-editor:empty::before {
      content: attr(data-placeholder);
      color: #999;
      pointer-events: none;
    }

    .rte-editor :where(p, ul, ol) {
      margin: 0 0 0.65em;
    }

    .rte-editor :where(p:last-child, ul:last-child, ol:last-child) {
      margin-bottom: 0;
    }

    .rte-editor ul,
    .rte-editor ol {
      padding-left: 1.35em;
    }
  `],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => RichTextEditorComponent),
    multi: true,
  }],
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit {
  @Input() placeholder = 'Escribe aquí...';
  @ViewChild('editor') editorRef?: ElementRef<HTMLDivElement>;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};
  private pendingValue = '';

  ngAfterViewInit() {
    this.syncEditor();
  }

  writeValue(value: string | null): void {
    this.pendingValue = value || '';
    this.syncEditor();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    const el = this.editorRef?.nativeElement;
    if (el) el.contentEditable = isDisabled ? 'false' : 'true';
  }

  runCmd(event: MouseEvent, command: string) {
    event.preventDefault();
    this.editorRef?.nativeElement.focus();
    document.execCommand(command, false);
    this.onInput();
  }

  onInput() {
    const el = this.editorRef?.nativeElement;
    if (!el) return;
    const html = el.innerHTML;
    this.onChange(this.isEmpty(html) ? '' : html);
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
    this.onInput();
  }

  private syncEditor() {
    const el = this.editorRef?.nativeElement;
    if (!el) return;

    const value = this.pendingValue;
    if (!value) {
      el.innerHTML = '';
      return;
    }

    if (this.looksLikeHtml(value)) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  }

  private looksLikeHtml(value: string) {
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private isEmpty(html: string) {
    const text = html
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    return !text;
  }
}
