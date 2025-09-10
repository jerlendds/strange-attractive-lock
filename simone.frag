#ifdef GL_ES
precision highp float;
#endif

uniform vec2  u_resolution;
uniform float u_time;

#define INTENSE     1
#if INTENSE
  #define SAMPLES   6
  #define WARMUP    900
  #define STEPS     720
#else
  #define SAMPLES   120
  #define WARMUP    180
  #define STEPS     420
#endif
#define ZOOM 0.55

float h11(float p){
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
mat3 r3(float ax,float ay,float az){
    float sx=sin(ax), cx=cos(ax);
    float sy=sin(ay), cy=cos(ay);
    float sz=sin(az), cz=cos(az);
    mat3 Rx=mat3(1,0,0, 0,cx,-sx, 0,sx,cx);
    mat3 Ry=mat3(cy,0,sy, 0,1,0, -sy,0,cy);
    mat3 Rz=mat3(cz,-sz,0, sz,cz,0, 0,0,1);
    return Rz*Ry*Rx;
}

// Neon teal/green/blue
vec3 neonTeal(float t){
    vec3 base  = vec3(0.010, 0.020, 0.028);   // deep blue-black
    vec3 teal  = vec3(0.000, 0.900, 0.700);   // neon teal
    vec3 cyan  = vec3(0.250, 0.980, 1.000);   // icy cyan
    vec3 white = vec3(1.000);
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(base, teal, smoothstep(0.00, 0.35, t));
    c = mix(c,   cyan, smoothstep(0.35, 0.80, t));
    c = mix(c,  white, smoothstep(0.80, 1.00, t));
    return c;
}

// Simone (Maybe) 3D extension
void simoneStep(inout vec3 p, float a, float b, float dt, float scale){
    vec3 n;
    n.x = sin(a * p.y) + cos(b * p.z);
    n.y = sin(a * p.z) + cos(b * p.x);
    n.z = sin(a * p.x) + cos(b * p.y);
    p += (scale * n - p) * dt;
}

void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*u_resolution.xy) / u_resolution.y;
    float t  = u_time;

    // core Simone parameters
    float a  = 5.51;
    float b  = 4.84;
    float dt = 0.012;   // faster settle for intense trails
    float sc = 1.90;

    // Camera + pulse
    mat3  R     = r3(0.65*sin(0.80*t), 0.82*cos(0.62*t), 0.45*sin(0.51*t));
    float pulse = 0.5 + 0.5*sin(0.42*t);
    float projS = (1.02 + 0.12*pulse) * ZOOM;
    float focus = (130.0 + 30.0*pulse) * ZOOM;
    float expo  = 3.2  + 1.8*pulse / pow(ZOOM, 0.6);

    // Background tone (teal-leaning black)
    vec3 colOut = vec3(0.010, 0.020, 0.026);

    float dens = 0.0;
    float wsum = 0.0;
    float hot  = 0.0; // gloow baybee

    float j = h11(dot(gl_FragCoord.xy, vec2(0.1234,0.3456)) + t*0.01);

    for (int s=0; s<SAMPLES; ++s){
        float ss = float(s);
        // fast convergence & ribbon structure
        vec3 p = 0.030 * vec3(
            sin(6.28318*(j + ss*0.071 + 0.13*t)),
            cos(6.28318*(j + ss*0.091 + 0.11*t)),
            sin(6.28318*(j + ss*0.053 + 0.07*t + 0.3))
        );

        // extra-sexy burn-in
        for (int k=0; k<WARMUP; ++k) simoneStep(p, a, b, dt, sc);

        // accumulate
        vec3 prev = p;
        for (int k=0; k<STEPS; ++k){
            simoneStep(p, a, b, dt, sc);

            vec3 q  = R * p;
            vec2 pr = q.xy * projS;

            // velocity for anisotropic sparkle
            float vmag = clamp(length(p - prev) * 6.0, 0.0, 1.0);
            prev = p;

            float d = length(pr - uv);
            // slightly anisotropic “splat”: sharper at low velocity, wider at high
            float tight = mix(1.10, 1.28, vmag);
            float splat = exp(-pow(d * focus, tight));

            // bias newer samples more, and also by velocity (energize arcs)
            float w = mix(0.70, 1.35, float(k)/float(STEPS));
            w *= mix(0.85, 1.15, vmag);

            dens += splat * w;
            wsum += w;

            // bright-pass proxy
            hot  += splat * w * smoothstep(0.0, 0.9, vmag);
        }
    }

    // normalize + tone map
    float nd  = dens / max(wsum, 1e-5);
    float g   = pow(clamp(nd * expo, 0.0, 1e4), 0.58);

    // map to neon teal/cyan and add extra electric punch
    vec3 col = neonTeal(0.32 + 0.55*log(1.0 + 1.8*g));
    col *= (0.22 + 2.8*g);

    // fake bloom: bright-pass adds squared energy
    float bp = clamp(hot / (float(SAMPLES)*float(STEPS)) * 6.0, 0.0, 1.0);
    col += (col * col) * (0.35 + 0.65*bp);   // electric glow

    // vignette + subtle cool grain
    float vig   = smoothstep(1.48, 0.10, length(uv));
    float grain = (h11(gl_FragCoord.x*0.37 + gl_FragCoord.y*1.23 + t)*2.0 - 1.0) * 0.008;
    col *= vig;
    col += grain;

    // gamma
    col = pow(max(col,0.0), vec3(0.4545));

    gl_FragColor = vec4(col, 1.0);
}
