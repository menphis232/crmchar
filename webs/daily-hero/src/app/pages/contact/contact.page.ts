import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CartService } from '../../core/cart.service';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
})
export class ContactPage {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    topic: ['order', Validators.required],
    message: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.route.fragment.pipe(takeUntilDestroyed()).subscribe((fragment) => {
      if (fragment === 'franchise') {
        this.form.controls.topic.setValue('franchise');
      }
    });
  }

  invalid(control: 'name' | 'email' | 'message'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const topic = this.form.controls.topic.value === 'franchise' ? 'Franchise note sent' : 'Message sent';
    this.cart.notify(topic);
    this.sent.set(true);
    this.form.reset({ name: '', email: '', topic: 'order', message: '' });
  }
}
