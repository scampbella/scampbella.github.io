tailwind.config = {
    theme: {
        extend: {
            "colors": {
                "primary": "var(--ct-primary)",
                "on-primary": "var(--ct-on-primary)",
                "primary-container": "var(--ct-primary-container)",
                "on-primary-container": "var(--ct-on-primary-container)",
                "secondary": "var(--ct-secondary)",
                "on-secondary": "var(--ct-on-secondary)",
                "secondary-container": "var(--ct-secondary-container)",
                "on-secondary-container": "var(--ct-on-secondary-container)",
                "tertiary": "var(--ct-tertiary)",
                "on-tertiary": "var(--ct-on-tertiary)",
                "tertiary-container": "var(--ct-tertiary-container)",
                "on-tertiary-container": "var(--ct-on-tertiary-container)",
                "error": "var(--ct-error)",
                "on-error": "var(--ct-on-error)",
                "error-container": "var(--ct-error-container)",
                "on-error-container": "var(--ct-on-error-container)",
                "outline": "var(--ct-outline)",
                "background": "var(--ct-background)",
                "on-background": "var(--ct-on-background)",
                "surface": "var(--ct-surface)",
                "on-surface": "var(--ct-on-surface)",
                "surface-variant": "var(--ct-surface-variant)",
                "on-surface-variant": "var(--ct-on-surface-variant)",
                "inverse-surface": "var(--ct-inverse-surface)",
                "inverse-on-surface": "var(--ct-inverse-on-surface)",
                "primary-fixed-dim": "var(--ct-primary-fixed-dim)",
                "surface-container-highest": "var(--ct-surface-container-highest)",
                "surface-container-high": "var(--ct-surface-container-high)",
                "surface-container": "var(--ct-surface-container)",
                "surface-container-low": "var(--ct-surface-container-low)",
                "surface-container-lowest": "var(--ct-surface-container-lowest)",
                "surface-bright": "var(--ct-surface-bright)",
                "outline-variant": "var(--ct-outline-variant)",
                "shadow": "var(--ct-shadow)"
            },
            "borderRadius": {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
            "spacing": {
                "gutter": "32px",
                "margin-desktop": "64px",
                "section-gap": "120px",
                "unit": "8px",
                "margin-mobile": "20px",
                "container-max": "1280px"
            },
            "fontFamily": {
                "headline-lg": ["Hanken Grotesk"],
                "label-md": ["Hanken Grotesk"],
                "body-md": ["Hanken Grotesk"],
                "headline-lg-mobile": ["Hanken Grotesk"],
                "body-lg": ["Hanken Grotesk"],
                "headline-xl": ["Hanken Grotesk"],
                "headline-md": ["Hanken Grotesk"],
                "label-sm": ["Hanken Grotesk"],
                "display-lg": ["Hanken Grotesk"]
            },
            "fontSize": {
                "headline-lg": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                "label-md": ["14px", { "lineHeight": "1.4", "letterSpacing": "0.02em", "fontWeight": "500" }],
                "body-md": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
                "headline-lg-mobile": ["28px", { "lineHeight": "1.2", "fontWeight": "600" }],
                "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }],
                "headline-xl": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "600" }],
                "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "500" }],
                "label-sm": ["12px", { "lineHeight": "1.4", "letterSpacing": "0.05em", "fontWeight": "600" }],
                "display-lg": ["64px", { "lineHeight": "1.1", "letterSpacing": "-0.04em", "fontWeight": "700" }]
            }
        },
    },
};