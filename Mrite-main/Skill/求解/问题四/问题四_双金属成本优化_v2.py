"""
问题四v2: 双金属成本优化（高效版）
策略：对每个N_A，二分搜索最小N_B使概率>=90%
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

plt.rcParams['font.sans-serif'] = ['STHeiti', 'SimHei', 'Heiti TC',
    'Arial Unicode MS', 'Hiragino Sans GB', 'PingFang SC',
    'Microsoft YaHei', 'Songti SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 150
plt.rcParams['savefig.bbox'] = 'tight'

from core_geometry import (
    CUBE_SIZE, CUBE_HALF, R_A, L_A, R_B, TUNNELING_DIST,
    ELECTRODE_LEFT, ELECTRODE_RIGHT,
    cylinder_to_plane_distance, compute_volume_A, compute_volume_B,
    generate_random_particle_A, generate_random_particle_B, UnionFind,
    segment_to_segment_distance_3d, point_to_segment_distance_periodic
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(BASE_DIR, '图片')
OUT_DIR = os.path.join(BASE_DIR, '结果')
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

def despine(ax):
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

def save_fig(fig, name):
    fig.savefig(os.path.join(FIG_DIR, name), bbox_inches='tight'); plt.close(fig)

def save_csv(df, name):
    df.to_csv(os.path.join(OUT_DIR, name), index=False, encoding='utf-8-sig')


# ========== 双金属导通判定（优化版） ==========
def check_conduction_AB_fast(particles_A, particles_B):
    nA = len(particles_A)
    nB = len(particles_B)
    total = nA + nB
    if total == 0:
        return False
    LEFT = total; RIGHT = total + 1
    uf = UnionFind(total + 2)

    centers_A = np.array([(p[0]+p[1])/2 for p in particles_A]) if nA > 0 else np.zeros((0,3))
    centers_B = np.array(particles_B) if nB > 0 else np.zeros((0,3))

    # A - electrode
    for i, (p1, p2) in enumerate(particles_A):
        if cylinder_to_plane_distance(p1, p2, ELECTRODE_LEFT, R_A) <= TUNNELING_DIST:
            uf.union(i, LEFT)
        if cylinder_to_plane_distance(p1, p2, ELECTRODE_RIGHT, R_A) <= TUNNELING_DIST:
            uf.union(i, RIGHT)

    # B - electrode
    for i, c in enumerate(particles_B):
        idx = nA + i
        if abs(c[0] - ELECTRODE_LEFT) - R_B <= TUNNELING_DIST:
            uf.union(idx, LEFT)
        if abs(c[0] - ELECTRODE_RIGHT) - R_B <= TUNNELING_DIST:
            uf.union(idx, RIGHT)

    if uf.connected(LEFT, RIGHT):
        return True

    # Spatial hash
    cell_size = 5000.0
    n_cells = max(1, int(CUBE_SIZE / cell_size))
    grid = {}

    for i in range(nA):
        c = centers_A[i]
        key = (int((c[0]+CUBE_HALF)/cell_size)%n_cells,
               int((c[1]+CUBE_HALF)/cell_size)%n_cells,
               int((c[2]+CUBE_HALF)/cell_size)%n_cells)
        grid.setdefault(key, []).append(('A', i, c))

    for i in range(nB):
        c = centers_B[i]
        key = (int((c[0]+CUBE_HALF)/cell_size)%n_cells,
               int((c[1]+CUBE_HALF)/cell_size)%n_cells,
               int((c[2]+CUBE_HALF)/cell_size)%n_cells)
        grid.setdefault(key, []).append(('B', nA+i, c))

    def surf_dist(t1, i1, c1, t2, i2, c2):
        if t1 == 'A' and t2 == 'A':
            d = segment_to_segment_distance_3d(
                particles_A[i1][0], particles_A[i1][1],
                particles_A[i2][0], particles_A[i2][1])
            return d - 2*R_A
        elif t1 == 'B' and t2 == 'B':
            dx = min(abs(c1[0]-c2[0]), CUBE_SIZE-abs(c1[0]-c2[0]))
            dy = min(abs(c1[1]-c2[1]), CUBE_SIZE-abs(c1[1]-c2[1]))
            dz = min(abs(c1[2]-c2[2]), CUBE_SIZE-abs(c1[2]-c2[2]))
            return np.sqrt(dx**2+dy**2+dz**2) - 2*R_B
        else:
            if t1 == 'A':
                pa1, pa2 = particles_A[i1]; cb = c2
            else:
                pa1, pa2 = particles_A[i2]; cb = c1
            return point_to_segment_distance_periodic(cb, pa1, pa2) - R_A - R_B

    checked = set()
    for (cx, cy, cz), cell_ps in grid.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for p1 in cell_ps:
                        for p2 in grid.get(((cx+dx)%n_cells,(cy+dy)%n_cells,(cz+dz)%n_cells), []):
                            id1, id2 = p1[1], p2[1]
                            if id1 >= id2: continue
                            if (id1, id2) in checked: continue
                            checked.add((id1, id2))
                            if surf_dist(p1[0],p1[1],p1[2], p2[0],p2[1],p2[2]) <= TUNNELING_DIST:
                                uf.union(id1, id2)
                                if uf.connected(LEFT, RIGHT):
                                    return True
    return uf.connected(LEFT, RIGHT)


# ========== 主程序 ==========
print("=" * 60)
print("问题四v2：高效双金属成本优化")
print("=" * 60, flush=True)

V_A = compute_volume_A()
V_B_val = compute_volume_B()
V_total = CUBE_SIZE ** 3

COST_A = 1.05  # yuan/um^3
COST_B = 0.05  # yuan/um^3
cost_per_A = COST_A * V_A / 1e9   # nm^3 -> um^3
cost_per_B = COST_B * V_B_val / 1e9

print(f"Cost/particle: A={cost_per_A:.6f} yuan, B={cost_per_B:.6f} yuan")
print(f"V_A={V_A/1e9:.4e} um^3, V_B={V_B_val/1e9:.4e} um^3", flush=True)

# Pure A baseline from Problem 3
pure_A_N = 39
pure_A_cost = pure_A_N * cost_per_A
print(f"Pure A: N={pure_A_N}, cost={pure_A_cost:.6f} yuan", flush=True)

# Pure B: test how many needed (unlikely to be competitive)
print("\n--- Testing pure B ---", flush=True)
for nB_test in [100, 200, 500, 1000, 2000]:
    n_c = sum(1 for _ in range(100) if check_conduction_AB_fast([], [generate_random_particle_B() for _ in range(nB_test)]))
    print(f"  N_B={nB_test}: prob={n_c/100:.3f}", flush=True)

# For each N_A < 39, find min N_B for >= 90% via binary search
print("\n--- Binary search for each N_A ---", flush=True)
trials_per = 120  # trials per evaluation

results = []
# Include pure A
results.append({'N_A': pure_A_N, 'N_B': 0, 'cost': pure_A_cost})

for nA in [35, 30, 25, 20, 15, 10, 5, 0]:
    # Binary search for min N_B
    nB_low, nB_high = 0, 2000

    # First check if nB=0 works
    n_c = sum(1 for _ in range(trials_per)
        if check_conduction_AB_fast(
            [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(nA)]], []))
    if n_c / trials_per >= 0.90:
        results.append({'N_A': nA, 'N_B': 0, 'cost': nA * cost_per_A})
        print(f"  N_A={nA}: N_B=0 sufficient, prob={n_c/trials_per:.3f}, cost={nA*cost_per_A:.6f}", flush=True)
        continue

    # Check if N_B=2000 works
    n_c = sum(1 for _ in range(trials_per)
        if check_conduction_AB_fast(
            [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(nA)]],
            [generate_random_particle_B() for _ in range(nB_high)]))
    if n_c / trials_per < 0.90:
        print(f"  N_A={nA}: even N_B={nB_high} not enough, prob={n_c/trials_per:.3f}", flush=True)
        continue

    # Binary search
    for _ in range(12):
        nB_mid = (nB_low + nB_high) // 2
        n_c = sum(1 for _ in range(trials_per)
            if check_conduction_AB_fast(
                [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(nA)]],
                [generate_random_particle_B() for _ in range(nB_mid)]))
        prob = n_c / trials_per
        if prob >= 0.90:
            nB_high = nB_mid
        else:
            nB_low = nB_mid + 1

    nB_min = nB_high
    cost = nA * cost_per_A + nB_min * cost_per_B
    results.append({'N_A': nA, 'N_B': nB_min, 'cost': cost})
    print(f"  N_A={nA}: N_B_min={nB_min}, cost={cost:.6f} yuan", flush=True)

# Find best
best = min(results, key=lambda r: r['cost'])
pure_A_result = [r for r in results if r['N_A'] == pure_A_N][0]

print(f"\n{'='*60}")
print(f"最优: N_A={best['N_A']}, N_B={best['N_B']}, cost={best['cost']:.6f} yuan")
print(f"纯A: N_A={pure_A_N}, cost={pure_A_cost:.6f} yuan")
print(f"节省: {(pure_A_cost-best['cost'])/pure_A_cost*100:.1f}%", flush=True)

# ========== 验证最优配置 ==========
print("\n--- Large-sample verification ---", flush=True)
verify_trials = 500
n_c = sum(1 for _ in range(verify_trials)
    if check_conduction_AB_fast(
        [(p[0].copy(), p[1].copy()) for p in [generate_random_particle_A() for _ in range(best['N_A'])]],
        [generate_random_particle_B() for _ in range(best['N_B'])]))
prob_v = n_c / verify_trials
std_v = np.sqrt(prob_v*(1-prob_v)/verify_trials)
print(f"Verified: {n_c}/{verify_trials}={prob_v:.4f}+/-{std_v:.4f}", flush=True)

# Save
best_df = pd.DataFrame([{
    'N_A': best['N_A'], 'N_B': best['N_B'],
    '导通概率': f'{prob_v:.4f}', '总成本_yuan': f'{best["cost"]:.6f}',
    '纯A成本_yuan': f'{pure_A_cost:.6f}',
    '节省比例': f'{(pure_A_cost-best["cost"])/pure_A_cost*100:.1f}%',
    '填充率_A': f'{best["N_A"]*V_A/V_total:.4%}',
    '填充率_B': f'{best["N_B"]*V_B_val/V_total:.4%}'
}])
save_csv(best_df, '问题四最优配置.csv')
save_csv(pd.DataFrame(results), '问题四搜索结果.csv')

# ========== 绘图 ==========
# 1. Cost curve
fig, ax = plt.subplots(figsize=(8,5))
NAs = [r['N_A'] for r in results]
NBs = [r['N_B'] for r in results]
costs = [r['cost'] for r in results]
ax.plot(NAs, costs, 'o-', color='#2c7bb6', lw=2, ms=10, mfc='white', mew=2)
ax.axhline(y=pure_A_cost, color='#d7191c', ls='--', label=f'Pure A: {pure_A_cost:.6f}')
ax.scatter([best['N_A']], [best['cost']], color='red', s=200, zorder=5, marker='*')
ax.set_xlabel('N_A'); ax.set_ylabel('Total cost (yuan)')
ax.set_title('Cost vs N_A (with optimal N_B)'); ax.legend()
ax.grid(alpha=0.3, linestyle='--'); despine(ax)
save_fig(fig, '成本优化曲线.png')

# 2. Bar: Pure A vs Optimal
fig, ax = plt.subplots(figsize=(8,5))
labels = [f'Pure A\n({pure_A_N} particles)', f'Optimal mix\n(A={best["N_A"]}, B={best["N_B"]})']
values = [pure_A_cost, best['cost']]
colors = ['#d7191c', '#2c7bb6']
ax.bar(labels, values, color=colors, edgecolor='white', lw=2)
ax.set_ylabel('Total cost (yuan)'); ax.set_title('Cost comparison')
for i, v in enumerate(values):
    ax.text(i, v+0.0005, f'{v:.6f}', ha='center', fontweight='bold')
despine(ax); save_fig(fig, '成本对比图.png')

# 3. N_B needed vs N_A
fig, ax = plt.subplots(figsize=(8,5))
ax.bar([str(r['N_A']) for r in results], [r['N_B'] for r in results],
       color='#abd9e9', edgecolor='#2c7bb6', lw=1.5)
ax.set_xlabel('N_A'); ax.set_ylabel('Minimum N_B for >=90%')
ax.set_title('Required N_B at each N_A level')
for i, r in enumerate(results):
    ax.text(i, r['N_B']+20, str(r['N_B']), ha='center', fontsize=9)
despine(ax); save_fig(fig, 'NB_vs_NA.png')

# 4. 3D visualization
fig = plt.figure(figsize=(10,8))
ax = fig.add_subplot(111, projection='3d')
for _ in range(min(best['N_A'], 80)):
    p1,p2 = generate_random_particle_A()
    ax.plot([p1[0],p2[0]],[p1[1],p2[1]],[p1[2],p2[2]],'b-',alpha=0.3,lw=0.5)
for _ in range(min(best['N_B'], 150)):
    c = generate_random_particle_B()
    ax.scatter(*c, s=10, c='orange', alpha=0.5, edgecolors='none')
ax.set_xlabel('X(nm)'); ax.set_ylabel('Y(nm)'); ax.set_zlabel('Z(nm)')
ax.set_title(f'Optimal: A={best["N_A"]}, B={best["N_B"]}')
save_fig(fig, '最优配置3D分布.png')

print(f"\nDone! Results saved to {OUT_DIR}", flush=True)
