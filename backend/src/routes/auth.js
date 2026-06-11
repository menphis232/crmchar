import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { get, run } from '../db.js';
import { authRequired, signToken } from '../middleware/auth.js';
import Stripe from 'stripe';
import { sendEmail } from '../utils/mailer.js';

async function sendPaymentReminderEmail(toEmail, name, roleName, checkoutUrl) {
  const subject = `💳 Activa tu cuenta de ${roleName} en Trámites Vehiculares`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c8a94a;">Bienvenido, ${name}!</h2>
      <p>Tu cuenta de <strong>${roleName}</strong> fue creada exitosamente.</p>
      <p>Para acceder a tu panel y comenzar a operar, es necesario que actives tu suscripción mensual haciendo clic en el botón de abajo:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${checkoutUrl}" style="background: #c8a94a; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Activar mi cuenta &rarr;</a>
      </div>
      <p style="color: #888; font-size: 13px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${checkoutUrl}">${checkoutUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #888; font-size: 12px;">Trámites Vehiculares &mdash; Si no te registraste, ignora este correo.</p>
    </div>
  `;
  await sendEmail(toEmail, subject, `Activa tu cuenta: ${checkoutUrl}`, html);
}

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (!['gestor', 'concesionaria', 'cliente'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const exists = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });
    
    const userId = uuid();
    
    // Check if we need to enforce subscription payment
    let stripeCheckoutUrl = null;
    let initialStatus = 'active';

    if (role === 'gestor' || role === 'concesionaria') {
      const admin = await get("SELECT stripe_secret_key, stripe_price_id FROM users WHERE role = 'admin' LIMIT 1");
      if (admin && admin.stripe_secret_key && admin.stripe_price_id) {
        initialStatus = 'pending_payment';
        const origin = req.headers.origin || 'http://localhost:4200';
        const stripe = new Stripe(admin.stripe_secret_key);
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: admin.stripe_price_id, quantity: 1 }],
          success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/registro-pendiente?email=${encodeURIComponent(email.toLowerCase())}`,
          customer_email: email.toLowerCase(),
          metadata: { user_id: userId, role }
        });
        stripeCheckoutUrl = session.url;
      }
    }

    const hash = bcrypt.hashSync(password, 10);
    await run('INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email.toLowerCase(), hash, role, name, initialStatus]);

    if (role === 'concesionaria') {
      // Generate unique slug from name
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = `${baseSlug}-${userId.slice(0, 6)}`;
      await run('UPDATE users SET slug = ? WHERE id = ?', [slug, userId]);
    }

    if (role === 'gestor') {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await run(`
        INSERT INTO gestores (id, user_id, slug, name, location, state, banner_url, photo_url, bio, whatsapp, schedule)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuid(), userId, `${slug}-${userId.slice(0, 6)}`, name,
        'Ciudad de México', 'CDMX',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600',
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200',
        'Gestoría vehicular certificada.', '525500000000', 'Lunes a Viernes de 9am a 6pm',
      ]);
    }

    if (stripeCheckoutUrl) {
      // Send payment reminder email in the background
      const roleName = role === 'gestor' ? 'Gestoría' : 'Concesionaria';
      sendPaymentReminderEmail(email.toLowerCase(), name, roleName, stripeCheckoutUrl).catch(console.error);
      return res.status(201).json({ requirePayment: true, checkoutUrl: stripeCheckoutUrl });
    }

    const user = { id: userId, email: email.toLowerCase(), role, name };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar' });
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
    if (user.status === 'pending_payment') {
      return res.status(403).json({ error: 'Tu cuenta requiere una suscripción activa para acceder. Por favor revisa tu correo o contáctanos para el pago.' });
    }
    if (user.permissions && typeof user.permissions === 'string') {
      try { user.permissions = JSON.parse(user.permissions); } catch(e){}
    }
    const { password_hash, ...safe } = user;
    res.json({ token: signToken(safe), user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await get('SELECT id, email, role, name, parent_id, permissions, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, slug, description, phone, address, map_embed_url, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

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

    res.json({ user, profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

router.patch('/me', authRequired, async (req, res) => {
  try {
    const { name, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, description, phone, address, map_embed_url } = req.body;
    
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
    if (description !== undefined) { sets.push('description = ?'); params.push(description || null); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone || null); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address || null); }
    if (map_embed_url !== undefined) { sets.push('map_embed_url = ?'); params.push(map_embed_url || null); }
    
    if (sets.length > 0) {
      params.push(req.user.id);
      await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    
    const user = await get('SELECT id, email, role, name, logo_url, pdf_settings, google_analytics_id, stripe_secret_key, stripe_public_key, stripe_price_id, page_builder_config, ai_provider, ai_api_key, chatbot_bg_color, chatbot_btn_color, chatbot_text_color, slug, description, phone, address, map_embed_url, created_at FROM users WHERE id = ?', [req.user.id]);
    
    if (user.pdf_settings && typeof user.pdf_settings === 'string') {
      try { user.pdf_settings = JSON.parse(user.pdf_settings); } catch(e){}
    }
    if (user.page_builder_config && typeof user.page_builder_config === 'string') {
      try { user.page_builder_config = JSON.parse(user.page_builder_config); } catch(e){}
    }
    
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
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
