#ifdef GL_ES
precision highp float;
#endif

uniform vec2  u_resolution;
uniform float u_time;

// -------------------- PERFORMANCE KNOBS --------------------
#define SAMPLES  12     // trajectories per pixel (10–16 is plenty)
#define WARMUP   180    // let trajectories settle (140–220)
#define STEPS    420    // steps per trajectory (360–520)
// -----------------------------------------------------------

// --- small utils
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

// --- neon teal / green / blue palette (no purples)
vec3 neonTeal(float t){
    // background deep blue-green to cyan-white
    vec3 base   = vec3(0.010, 0.020, 0.028);        // near-black blue
    vec3 teal   = vec3(0.000, 0.850, 0.650);        // neon teal
    vec3 cyan   = vec3(0.250, 0.950, 1.000);        // icy cyan
    vec3 white  = vec3(1.000);
    // 0..1 bands: base -> teal -> cyan -> white
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(base, teal, smoothstep(0.00, 0.35, t));
    c = mix(c,   cyan, smoothstep(0.35, 0.75, t));
    c = mix(c,  white, smoothstep(0.75, 1.00, t));
    return c;
}

// --- Simone (Maybe) 3D extension (your map)
void simoneStep(inout vec3 p, float a, float b, float dt, float scale){
    vec3 n;
    n.x = sin(a * p.y) + cos(b * p.z);
    n.y = sin(a * p.z) + cos(b * p.x);
    n.z = sin(a * p.x) + cos(b * p.y);
    p += (scale * n - p) * dt;
}

void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*u_resolution.xy) / u_resolution.y;
    float t = u_time;

    // Fixed Simone constants (edit these two to change attractor)
    float a  = 5.51;
    float b  = 4.84;

    // Integrator params
    float dt = 0.010;   // faster settle, good visuals
    float sc = 1.80;

    // Camera + subtle breathing. Keep it cool/techy.
    mat3  R     = r3(0.45*sin(0.62*t), 0.60*cos(0.48*t), 0.30*sin(0.37*t));
    float pulse = 0.5 + 0.5*sin(0.35*t);
    float projS = 0.96 + 0.06*pulse;   // size on screen
    float focus = 105.0 + 15.0*pulse;  // point tightness
    float expo  = 2.4  + 1.0*pulse;    // brightness

    float dens = 0.0;
    float wsum = 0.0;

    // deterministic per-pixel jitter
    float j = h11(dot(gl_FragCoord.xy, vec2(0.1234,0.3456)) + t*0.01);

    // Background: deep blue-green; early write so empty areas aren’t purple.
    vec3 outColor = vec3(0.010, 0.020, 0.028);

    for (int s=0; s<SAMPLES; ++s){
        float ss = float(s);

        // Seed close to origin for fast convergence & ribbon structure
        vec3 p = 0.035 * vec3(
            sin(6.28318*(j + ss*0.071 + 0.13*t)),
            cos(6.28318*(j + ss*0.091 + 0.11*t)),
            sin(6.28318*(j + ss*0.053 + 0.07*t + 0.3))
        );

        // Burn-in
        for (int k=0; k<WARMUP; ++k) simoneStep(p, a, b, dt, sc);

        // Accumulate “dot” density
        for (int k=0; k<STEPS; ++k){
            simoneStep(p, a, b, dt, sc);

            vec3 q  = R * p;
            vec2 pr = q.xy * projS;

            float d = length(pr - uv);
            // Narrow, cheap Gaussian-ish splat
            float splat = exp(-pow(d * focus, 1.18));

            // Bias toward newer samples → brighter tips
            float w = mix(0.66, 1.18, float(k)/float(STEPS));

            dens += splat * w;
            wsum += w;
        }
    }

    // Normalize and map to neon teal/cyan
    float nd   = dens / max(wsum, 1e-5);
    float g    = pow(clamp(nd * expo, 0.0, 1e4), 0.60);
    vec3  col  = neonTeal(0.30 + 0.50*log(1.0 + 1.6*g)); // teal scale
    col       *= (0.18 + 2.2*g);                         // bloom-ish punch

    // Vignette (cool tone) and light grain
    float vig   = smoothstep(1.45, 0.08, length(uv));
    float grain = (h11(gl_FragCoord.x*0.37 + gl_FragCoord.y*1.23 + t)*2.0 - 1.0) * 0.008;
    col *= vig;
    col += grain;

    // Gamma
    col = pow(max(col, 0.0), vec3(0.4545));

    gl_FragColor = vec4(col, 1.0);
}
