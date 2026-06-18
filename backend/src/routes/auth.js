import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { get, run } from '../db.js';
import { authRequired, signToken } from '../middleware/auth.js';
import Stripe from 'stripe';
import { sendEmail } from '../utils/mailer.js';
import { getFrontendBase } from '../utils/frontend-url.js';
import {
  getPlatformStripeAdmin,
  getOrgSubscriptionStatus,
  sendActivationEmailByEmail,
  activateUserSubscription,
  createActivationCheckout,
} from '../utils/subscription-lifecycle.js';

function getRegisterOrigin() {
  return getFrontendBase();
}

async function sendForgotPasswordEmail(toEmail, name, newPassword) {
  const subject = `Tu nueva contraseña de Trámites Vehiculares`;
  const html = `
      <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Hola, ${name}</h2>
      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Hemos recibido una solicitud para restablecer tu contraseña. A continuación, te proporcionamos una contraseña provisional generada automáticamente de forma segura.</p>
      
      <div style="background-color: #0f1117; border: 1px dashed #c8a94a; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
        <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Tu contraseña provisional es:</p>
        <span style="font-size: 28px; font-weight: bold; color: #c8a94a; letter-spacing: 4px;">${newPassword}</span>
      </div>

      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Te recomendamos iniciar sesión lo antes posible. Una vez dentro de tu panel, puedes cambiar esta contraseña desde la sección de <strong>Ajustes</strong>.</p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="http://localhost:4200/login" style="background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Iniciar Sesión Ahora</a>
      </div>
  `;
  await sendEmail(toEmail, subject, `Tu contraseña provisional es: ${newPassword}`, html);
}

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (String(name).trim().length < 2) {
      return res.status(400).json({ error: 'El nombre comercial es obligatorio' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!['gestor', 'concesionaria', 'cliente'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const exists = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });
    
    const userId = uuid();
    
    // Check if we need to enforce subscription payment
    let stripeCheckoutUrl = null;
    let stripeSessionId = null;
    let initialStatus = 'active';

    if (role === 'gestor' || role === 'concesionaria') {
      const admin = await getPlatformStripeAdmin();
      if (admin) {
        try {
          initialStatus = 'pending_payment';
          const origin = getRegisterOrigin();
          const stripe = new Stripe(admin.stripe_secret_key);
          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: admin.stripe_price_id, quantity: 1 }],
            success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/registro-pendiente?email=${encodeURIComponent(email.toLowerCase())}`,
            customer_email: email.toLowerCase(),
            metadata: { user_id: userId, role },
          });
          stripeCheckoutUrl = session.url;
          stripeSessionId = session.id;
        } catch (stripeErr) {
          console.error('Stripe register error:', stripeErr);
          return res.status(400).json({
            error: 'No se pudo iniciar el pago de suscripción. Revisa la configuración de Stripe (clave y Price ID) en el panel admin.',
            details: stripeErr.message,
          });
        }
      }
    }

    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email.toLowerCase(), hash, role, String(name).trim(), initialStatus]);

    if (role === 'concesionaria') {
      // Generate unique slug from name
      const baseSlug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'concesionaria';
      const slug = `${baseSlug}-${userId.slice(0, 6)}`;
      await run('UPDATE users SET slug = ? WHERE id = ?', [slug, userId]);
    }

    if (role === 'gestor') {
      const slugBase = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'gestor';
      await run(`
        INSERT INTO gestores (id, user_id, slug, name, location, state, banner_url, photo_url, bio, whatsapp, schedule)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuid(), userId, `${slugBase}-${userId.slice(0, 6)}`, String(name).trim(),
        'Ciudad de México', 'CDMX',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600',
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200',
        'Gestoría vehicular certificada.', '525500000000', 'Lunes a Viernes de 9am a 6pm',
      ]);
    }

    if (stripeSessionId) {
      await run('UPDATE users SET stripe_checkout_session_id = ? WHERE id = ?', [stripeSessionId, userId]).catch(() => {});
    }

    if (stripeCheckoutUrl) {
      // No enviar correo aquí: el usuario va directo a pagar. El correo se envía solo si cancela o falla el pago.
      return res.status(201).json({ requirePayment: true, checkoutUrl: stripeCheckoutUrl });
    }

    const user = { id: userId, email: email.toLowerCase(), role, name: String(name).trim() };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al registrar', details: err.message });
  }
});

router.post('/send-activation-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const result = await sendActivationEmailByEmail(email.toLowerCase());
    if (result.sent) return res.json({ success: true });
    if (result.reason === 'already_active') {
      return res.json({ success: true, message: 'Tu cuenta ya está activa' });
    }
    if (result.reason === 'deactivated') {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta soporte.' });
    }
    return res.status(404).json({ error: 'Usuario no encontrado' });
  } catch (err) {
    console.error('send-activation-email error:', err);
    res.status(500).json({ error: 'No se pudo enviar el correo de activación' });
  }
});

router.post('/resume-payment', authRequired, async (req, res) => {
  try {
    const user = await get('SELECT id, email, name, role, status, parent_id FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.parent_id) {
      return res.status(403).json({ error: 'Solo el titular puede gestionar el pago' });
    }
    if (user.status === 'active') {
      return res.json({ success: true, message: 'Cuenta ya activa' });
    }

    const admin = await getPlatformStripeAdmin();
    if (!admin) return res.status(400).json({ error: 'Stripe no configurado' });

    const stripe = new Stripe(admin.stripe_secret_key);
    const checkoutUrl = await createActivationCheckout(user, stripe, admin.stripe_price_id);

    if (user.status !== 'pending_payment' && user.status !== 'deactivated') {
      await run("UPDATE users SET status = 'pending_payment' WHERE id = ?", [user.id]);
    }

    return res.json({ success: true, checkoutUrl });
  } catch (err) {
    console.error('resume-payment error:', err);
    res.status(500).json({ error: 'No se pudo generar el enlace de pago' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (user.permissions && typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e){}
    }
    const subscriptionStatus = await getOrgSubscriptionStatus(user.id, user.parent_id);
    const { password_hash, status: _s, ...safe } = user;
    safe.status = subscriptionStatus;
    if (user.parent_id) {
      const org = await get('SELECT payment_failed_count FROM users WHERE id = ?', [user.parent_id]);
      safe.payment_failed_count = org?.payment_failed_count || 0;
    } else {
      safe.payment_failed_count = user.payment_failed_count || 0;
    }
    res.json({ token: signToken(safe), user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    // For security, always return success even if user not found, 
    // but in this case we return success to UI but log if not found.
    if (!user) {
      return res.json({ success: true });
    }

    // Generate random 8-char alphanumeric password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Hash and update
    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);

    // Send email
    await sendForgotPasswordEmail(user.email, user.name, newPassword);

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await get('SELECT id, email, role, name, parent_id, permissions, status, payment_failed_count, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, panel_assistant_enabled, panel_assistant_name, panel_assistant_position, panel_assistant_bg_color, panel_assistant_btn_color, panel_assistant_text_color, panel_assistant_font, panel_assistant_prompt, slug, description, phone, address, map_embed_url, crm_stages, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.status = await getOrgSubscriptionStatus(user.id, user.parent_id);
    if (user.parent_id) {
      const org = await get('SELECT payment_failed_count FROM users WHERE id = ?', [user.parent_id]);
      user.payment_failed_count = org?.payment_failed_count || 0;
    }

    let profile = null;
    if (user.role === 'gestor') {
      const orgId = user.parent_id || user.id;
      profile = await get('SELECT * FROM gestores WHERE user_id = ?', [orgId]);
    }
    
    // Parse pdf_settings if exists
    if (user.pdf_settings && typeof user.pdf_settings === 'string') {
      try { user.pdf_settings = JSON.parse(user.pdf_settings); } catch(e){}
    }
    if (user.permissions && typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e){}
    }
    if (user.page_builder_config && typeof user.page_builder_config === 'string') {
      try { user.page_builder_config = JSON.parse(user.page_builder_config); } catch(e){}
    }
    if (user.crm_stages && typeof user.crm_stages === 'string') {
      try { user.crm_stages = JSON.parse(user.crm_stages); } catch(e){}
    }

    res.json({ user, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

router.patch('/me', authRequired, async (req, res) => {
  try {
    const { name, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, panel_assistant_enabled, panel_assistant_name, panel_assistant_position, panel_assistant_bg_color, panel_assistant_btn_color, panel_assistant_text_color, panel_assistant_font, panel_assistant_prompt, description, phone, address, map_embed_url, crm_stages } = req.body;
    
    const sets = [];
    const params = [];
    
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (logo_url !== undefined) { sets.push('logo_url = ?'); params.push(logo_url); }
    if (pdf_settings !== undefined) { sets.push('pdf_settings = ?'); params.push(JSON.stringify(pdf_settings)); }
    if (google_analytics_id !== undefined) { sets.push('google_analytics_id = ?'); params.push(google_analytics_id || null); }
    if (stripe_secret_key !== undefined) { sets.push('stripe_secret_key = ?'); params.push(stripe_secret_key || null); }
    if (stripe_public_key !== undefined) { sets.push('stripe_public_key = ?'); params.push(stripe_public_key || null); }
    if (stripe_price_id !== undefined) { sets.push('stripe_price_id = ?'); params.push(stripe_price_id || null); }
    if (page_builder_config !== undefined) { sets.push('page_builder_config = ?'); params.push(JSON.stringify(page_builder_config)); }
    if (ai_provider !== undefined) { sets.push('ai_provider = ?'); params.push(ai_provider || null); }
    if (ai_api_key !== undefined) { sets.push('ai_api_key = ?'); params.push(ai_api_key || null); }
    if (chatbot_bg_color !== undefined) { sets.push('chatbot_bg_color = ?'); params.push(chatbot_bg_color || '#000000'); }
    if (chatbot_btn_color !== undefined) { sets.push('chatbot_btn_color = ?'); params.push(chatbot_btn_color || '#4F46E5'); }
    if (chatbot_text_color !== undefined) { sets.push('chatbot_text_color = ?'); params.push(chatbot_text_color || '#FFFFFF'); }
    if (panel_assistant_enabled !== undefined) { sets.push('panel_assistant_enabled = ?'); params.push(panel_assistant_enabled ? 1 : 0); }
    if (panel_assistant_name !== undefined) { sets.push('panel_assistant_name = ?'); params.push((panel_assistant_name || 'VEGA').slice(0, 50)); }
    if (panel_assistant_position !== undefined) { sets.push('panel_assistant_position = ?'); params.push(panel_assistant_position || 'bottom-right'); }
    if (panel_assistant_bg_color !== undefined) { sets.push('panel_assistant_bg_color = ?'); params.push(panel_assistant_bg_color || '#0f172a'); }
    if (panel_assistant_btn_color !== undefined) { sets.push('panel_assistant_btn_color = ?'); params.push(panel_assistant_btn_color || '#4F46E5'); }
    if (panel_assistant_text_color !== undefined) { sets.push('panel_assistant_text_color = ?'); params.push(panel_assistant_text_color || '#FFFFFF'); }
    if (panel_assistant_font !== undefined) { sets.push('panel_assistant_font = ?'); params.push(panel_assistant_font || 'Spartan'); }
    if (panel_assistant_prompt !== undefined) { sets.push('panel_assistant_prompt = ?'); params.push(panel_assistant_prompt || null); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description || null); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone || null); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address || null); }
    if (map_embed_url !== undefined) { sets.push('map_embed_url = ?'); params.push(map_embed_url || null); }
    if (crm_stages !== undefined) { sets.push('crm_stages = ?'); params.push(JSON.stringify(crm_stages)); }
    
    if (sets.length > 0) {
      params.push(req.user.id);
      await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    
    const user = await get('SELECT id, email, role, name, parent_id, permissions, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, panel_assistant_enabled, panel_assistant_name, panel_assistant_position, panel_assistant_bg_color, panel_assistant_btn_color, panel_assistant_text_color, panel_assistant_font, panel_assistant_prompt, slug, description, phone, address, map_embed_url, crm_stages, created_at FROM users WHERE id = ?', [req.user.id]);
    
    if (user.pdf_settings && typeof user.pdf_settings === 'string') {
      try { user.pdf_settings = JSON.parse(user.pdf_settings); } catch(e){}
    }
    if (user.page_builder_config && typeof user.page_builder_config === 'string') {
      try { user.page_builder_config = JSON.parse(user.page_builder_config); } catch(e){}
    }
    if (user.permissions && typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e){}
    }
    if (user.crm_stages && typeof user.crm_stages === 'string') {
      try { user.crm_stages = JSON.parse(user.crm_stages); } catch(e){}
    }
    
    console.log('[DEBUG] PATCH /me success, returning user');
    res.json({ user });
  } catch (err) {
    console.error('[DEBUG] PATCH /me ERROR:', err);
    res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
  }
});

router.patch('/change-password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // If they have a real password (not forced provisional), validate current
    if (currentPassword) {
      const valid = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

export default router;
