<?php
/**
 * Plugin Name: Search Mind Connector
 * Plugin URI:  https://search-mind.cloud
 * Description: Connecteur officiel Search Mind — expose les balises SEO des plugins Yoast, Rank Math, AIOSEO et SEOPress via l'API REST WordPress, même avec Elementor ou des builders qui bloquent l'accès natif.
 * Version:     1.0.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * Author:      Search Mind
 * License:     GPL v2 or later
 * Text Domain: searchmind-connector
 */

defined( 'ABSPATH' ) || exit;

define( 'SMC_VERSION',    '1.0.0' );
define( 'SMC_OPTION_KEY', 'searchmind_connector_api_key' );
define( 'SMC_NS',         'searchmind/v1' );

// ── Activation : génère la clé API ───────────────────────────────────────────

register_activation_hook( __FILE__, 'smc_activate' );
function smc_activate() {
    if ( ! get_option( SMC_OPTION_KEY ) ) {
        update_option( SMC_OPTION_KEY, wp_generate_password( 32, false ) );
    }
}

// ── Enregistrement des meta SEO en REST (Option A) ───────────────────────────
//
// Permet au flux Application Password existant de Search Mind de fonctionner
// même avec Elementor ou d'autres builders qui n'enregistrent pas les champs
// Yoast/RankMath/AIOSEO/SEOPress pour l'API REST.

add_action( 'init', 'smc_register_seo_meta', 20 );
function smc_register_seo_meta() {
    $public_types = array_keys( get_post_types( [ 'public' => true ] ) );

    $fields = [];

    if ( defined( 'WPSEO_VERSION' ) ) {
        $fields = array_merge( $fields, [
            '_yoast_wpseo_title',
            '_yoast_wpseo_metadesc',
            '_yoast_wpseo_focuskw',
            '_yoast_wpseo_meta-robots-noindex',
            '_yoast_wpseo_meta-robots-nofollow',
            '_yoast_wpseo_canonical',
        ] );
    }

    if ( defined( 'RANK_MATH_VERSION' ) ) {
        $fields = array_merge( $fields, [
            'rank_math_title',
            'rank_math_description',
            'rank_math_focus_keyword',
            'rank_math_robots',
            'rank_math_canonical_url',
        ] );
    }

    if ( defined( 'AIOSEO_VERSION' ) ) {
        $fields = array_merge( $fields, [
            '_aioseo_title',
            '_aioseo_description',
            '_aioseo_keywords',
            '_aioseo_og_title',
            '_aioseo_og_description',
        ] );
    }

    if ( function_exists( 'seopress_init' ) || defined( 'SEOPRESS_VERSION' ) ) {
        $fields = array_merge( $fields, [
            '_seopress_titles_title',
            '_seopress_titles_desc',
            '_seopress_robots_index',
            '_seopress_robots_follow',
        ] );
    }

    foreach ( $public_types as $post_type ) {
        foreach ( array_unique( $fields ) as $key ) {
            register_post_meta( $post_type, $key, [
                'show_in_rest'      => true,
                'single'            => true,
                'type'              => 'string',
                'auth_callback'     => function() {
                    return current_user_can( 'edit_posts' );
                },
                'sanitize_callback' => 'sanitize_text_field',
            ] );
        }
    }
}

// ── Routes REST dédiées ───────────────────────────────────────────────────────

add_action( 'rest_api_init', 'smc_register_routes' );
function smc_register_routes() {
    register_rest_route( SMC_NS, '/status', [
        'methods'             => 'GET',
        'callback'            => 'smc_route_status',
        'permission_callback' => 'smc_check_key',
    ] );

    register_rest_route( SMC_NS, '/update-meta', [
        'methods'             => 'POST',
        'callback'            => 'smc_route_update_meta',
        'permission_callback' => 'smc_check_key',
        'args'                => [
            'post_id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
                'minimum'           => 1,
            ],
            'title' => [
                'required'          => false,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'description' => [
                'required'          => false,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'focus_keyword' => [
                'required'          => false,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );
}

// ── Authentification par clé API ─────────────────────────────────────────────

function smc_check_key() {
    $stored = get_option( SMC_OPTION_KEY, '' );
    if ( empty( $stored ) ) {
        return new WP_Error( 'no_key', 'Clé API non configurée.', [ 'status' => 500 ] );
    }

    $header = isset( $_SERVER['HTTP_X_SEARCHMIND_KEY'] )
        ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_SEARCHMIND_KEY'] ) )
        : '';

    if ( ! hash_equals( $stored, $header ) ) {
        return new WP_Error( 'unauthorized', 'Clé API invalide ou manquante.', [ 'status' => 401 ] );
    }

    return true;
}

// ── Détection du plugin SEO actif ─────────────────────────────────────────────

function smc_detect_plugin() {
    if ( defined( 'WPSEO_VERSION' ) )                                        return 'yoast';
    if ( defined( 'RANK_MATH_VERSION' ) )                                    return 'rankmath';
    if ( defined( 'AIOSEO_VERSION' ) )                                       return 'aioseo';
    if ( function_exists( 'seopress_init' ) || defined( 'SEOPRESS_VERSION' ) ) return 'seopress';
    return 'unknown';
}

function smc_meta_keys( $plugin ) {
    return [
        'yoast'    => [
            'title'         => '_yoast_wpseo_title',
            'description'   => '_yoast_wpseo_metadesc',
            'focus_keyword' => '_yoast_wpseo_focuskw',
        ],
        'rankmath' => [
            'title'         => 'rank_math_title',
            'description'   => 'rank_math_description',
            'focus_keyword' => 'rank_math_focus_keyword',
        ],
        'aioseo'   => [
            'title'         => '_aioseo_title',
            'description'   => '_aioseo_description',
            'focus_keyword' => '_aioseo_keywords',
        ],
        'seopress' => [
            'title'         => '_seopress_titles_title',
            'description'   => '_seopress_titles_desc',
            'focus_keyword' => null,
        ],
    ][ $plugin ] ?? null;
}

// ── Callback : statut ─────────────────────────────────────────────────────────

function smc_route_status() {
    return rest_ensure_response( [
        'version'    => SMC_VERSION,
        'seo_plugin' => smc_detect_plugin(),
        'site_url'   => get_site_url(),
        'endpoint'   => get_rest_url( null, SMC_NS . '/update-meta' ),
    ] );
}

// ── Callback : mise à jour des meta SEO ──────────────────────────────────────

function smc_route_update_meta( WP_REST_Request $req ) {
    $post_id = $req->get_param( 'post_id' );

    $post = get_post( $post_id );
    if ( ! $post ) {
        return new WP_Error( 'not_found', 'Post introuvable.', [ 'status' => 404 ] );
    }

    $plugin = smc_detect_plugin();
    $keys   = smc_meta_keys( $plugin );

    if ( ! $keys ) {
        return new WP_Error( 'no_seo_plugin', 'Aucun plugin SEO compatible actif.', [ 'status' => 400 ] );
    }

    $updated = [];

    $title         = $req->get_param( 'title' );
    $description   = $req->get_param( 'description' );
    $focus_keyword = $req->get_param( 'focus_keyword' );

    if ( null !== $title ) {
        update_post_meta( $post_id, $keys['title'], $title );
        $updated['title'] = $title;
    }
    if ( null !== $description ) {
        update_post_meta( $post_id, $keys['description'], $description );
        $updated['description'] = $description;
    }
    if ( null !== $focus_keyword && ! empty( $keys['focus_keyword'] ) ) {
        update_post_meta( $post_id, $keys['focus_keyword'], $focus_keyword );
        $updated['focus_keyword'] = $focus_keyword;
    }

    // Pousse la mise à jour dans le cache indexable de Yoast
    if ( 'yoast' === $plugin && function_exists( 'YoastSEO' ) ) {
        $surface = YoastSEO()->classes->get( 'Yoast\WP\SEO\Surfaces\Meta_Surface' );
        if ( $surface && method_exists( $surface, 'for_post' ) ) {
            $surface->for_post( $post_id );
        }
    }

    return rest_ensure_response( [
        'success' => true,
        'post_id' => $post_id,
        'plugin'  => $plugin,
        'updated' => $updated,
    ] );
}

// ── Page d'administration ─────────────────────────────────────────────────────

add_action( 'admin_menu', 'smc_admin_menu' );
function smc_admin_menu() {
    add_options_page(
        'Search Mind Connector',
        'Search Mind',
        'manage_options',
        'searchmind-connector',
        'smc_admin_page'
    );
}

function smc_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( esc_html__( 'Permission refusée.', 'searchmind-connector' ) );
    }

    $api_key = get_option( SMC_OPTION_KEY, '' );

    if ( isset( $_POST['smc_regenerate'] ) && check_admin_referer( 'smc_regenerate_key' ) ) {
        $api_key = wp_generate_password( 32, false );
        update_option( SMC_OPTION_KEY, $api_key );
        echo '<div class="notice notice-success is-dismissible"><p><strong>Nouvelle clé API générée.</strong> Mettez-la à jour dans Search Mind → Intégrations.</p></div>';
    }

    $plugin      = smc_detect_plugin();
    $endpoint    = get_rest_url( null, SMC_NS . '/update-meta' );
    $status_url  = get_rest_url( null, SMC_NS . '/status' );
    $plugin_label = [
        'yoast'    => 'Yoast SEO',
        'rankmath' => 'Rank Math',
        'aioseo'   => 'All in One SEO',
        'seopress' => 'SEOPress',
        'unknown'  => '—',
    ][ $plugin ] ?? '—';

    ?>
    <div class="wrap" style="max-width:680px">
        <h1 style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">🔍</span> Search Mind Connector
            <span style="font-size:12px;font-weight:400;background:#e7f3ff;color:#0073aa;padding:2px 10px;border-radius:12px;vertical-align:middle">v<?php echo esc_html( SMC_VERSION ); ?></span>
        </h1>

        <div style="background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:20px 24px;margin-top:16px">
            <h2 style="margin-top:0;font-size:15px;border-bottom:1px solid #f0f0f1;padding-bottom:10px">Statut</h2>
            <table style="border-collapse:collapse;width:100%">
                <tr>
                    <td style="padding:7px 0;color:#646970;width:180px">Plugin SEO détecté</td>
                    <td style="padding:7px 0">
                        <?php if ( 'unknown' !== $plugin ) : ?>
                            <span style="background:#d1fae5;color:#065f46;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600"><?php echo esc_html( $plugin_label ); ?></span>
                        <?php else : ?>
                            <span style="color:#b91c1c;font-size:13px">Aucun plugin SEO compatible détecté</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <td style="padding:7px 0;color:#646970">Endpoint REST</td>
                    <td style="padding:7px 0;font-family:monospace;font-size:12px;word-break:break-all"><?php echo esc_html( $endpoint ); ?></td>
                </tr>
            </table>
        </div>

        <div style="background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:20px 24px;margin-top:12px">
            <h2 style="margin-top:0;font-size:15px;border-bottom:1px solid #f0f0f1;padding-bottom:10px">Clé API</h2>
            <p style="color:#646970;font-size:13px;margin-top:0">Copiez cette clé dans <strong>Search Mind → Intégrations → Plugin connecteur</strong>.</p>
            <div style="display:flex;gap:8px;align-items:center">
                <input
                    id="smc-key"
                    type="text"
                    readonly
                    value="<?php echo esc_attr( $api_key ); ?>"
                    onclick="this.select()"
                    style="font-family:monospace;font-size:13px;flex:1"
                    class="large-text"
                />
                <button
                    type="button"
                    class="button"
                    onclick="
                        navigator.clipboard.writeText(document.getElementById('smc-key').value)
                            .then(function(){ this.textContent = 'Copié !'; var b = this; setTimeout(function(){ b.textContent = 'Copier'; }, 2000); }.bind(this));
                    "
                >Copier</button>
            </div>

            <form method="post" style="margin-top:14px">
                <?php wp_nonce_field( 'smc_regenerate_key' ); ?>
                <input
                    type="submit"
                    name="smc_regenerate"
                    class="button button-secondary"
                    value="Régénérer la clé"
                    onclick="return confirm('Attention : la clé actuelle dans Search Mind cessera de fonctionner. Confirmer ?')"
                />
            </form>
        </div>

        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:4px;padding:14px 18px;margin-top:12px;font-size:13px;color:#78350f">
            <strong>Note sur l'indicateur Yoast</strong><br>
            Les balises mises à jour par Search Mind sont actives sur votre site immédiatement. L'indicateur visuel dans l'éditeur WordPress peut rester grisé jusqu'à la prochaine ouverture manuelle du post — c'est un comportement attendu de Yoast, pas un problème.
        </div>
    </div>
    <?php
}
