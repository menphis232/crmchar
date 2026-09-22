<?php
/**
 * Plugin Name: Disable All Emails (temp)
 * Description: Bloquea cualquier envio de correo de WordPress en este entorno temporal.
 * Author: temp-setup
 */

add_filter('pre_wp_mail', static function () {
	return true;
}, 999);

add_action('phpmailer_init', static function ($phpmailer) {
	$phpmailer->ClearAllRecipients();
	$phpmailer->ClearAttachments();
	$phpmailer->ClearCustomHeaders();
	$phpmailer->ClearReplyTos();
}, 999);
