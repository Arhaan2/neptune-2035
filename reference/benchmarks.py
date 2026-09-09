#!/usr/bin/env python3
"""Independent reduced-order numerical verification fixtures, not empirical validation.

No application imports. Closed-form and rational benchmarks are calculated directly;
the transient reference uses independent RK4 integration at 0.01 s instead of the
production analytical linear-node update. Run: python3 reference/benchmarks.py
"""
import json
import math
from fractions import Fraction
from pathlib import Path


def air_reference():
    """C dT/dt = P - G(T-Tamb), solved using a separate RK4 method."""
    temperature = 298.15
    ambient, power, conductance, capacitance, step = 298.15, 100000.0, 22500.0, 12000000.0, 0.01
    def derivative(t):
        return (power - conductance * (t - ambient)) / capacitance
    for _ in range(12000):
        k1 = derivative(temperature)
        k2 = derivative(temperature + step * k1 / 2)
        k3 = derivative(temperature + step * k2 / 2)
        k4 = derivative(temperature + step * k3)
        temperature += step * (k1 + 2*k2 + 2*k3 + k4) / 6
    return temperature


def main():
    # Equal fluid capacity 1000 W/K, equal NTU=1 gives ε=1/2.
    heat_w = Fraction(1, 2) * 1000 * 20
    # 250 kPa shutoff pump at Q_free=.1; equipment drop80 kPa at Q_ref=.05.
    # Solve 250000 - 25e6 Q² = 32e6 Q² explicitly rather than bracket iteration.
    flow = math.sqrt(250000 / 57000000)
    head = float(Fraction(250000 * 32, 57))
    initial_energy, discharge, dt, eta = Fraction(10000), Fraction(500000), Fraction(30), Fraction(95, 100)
    battery_wh = initial_energy - discharge / eta * dt / 3600
    mass, waterplane, density = 1000000, 2*58*6, 1025
    fixtures = {
        'schemaVersion': 1,
        'evidence': 'independent numerical verification; no measurements',
        'generator': 'reference/benchmarks.py',
        'heatExchangerEqualCapacity': {
            'capacityRateWPerK': 1000, 'uaWPerK': 1000,
            'hotInletK': 313.15, 'coldInletK': 293.15,
            'effectiveness': 0.5, 'heatW': float(heat_w),
            'hotOutletK': 303.15, 'coldOutletK': 303.15,
            'absoluteToleranceW': 1e-7,
        },
        'hydraulicQuadratic': {
            'lengthM': 0, 'fittingsK': 0, 'flowM3S': flow, 'pressurePa': head,
            'pumpElectricalW': head*flow/0.72,
            'absoluteFlowToleranceM3S': 1e-10, 'absolutePressureTolerancePa': 0.01,
        },
        'batteryDischarge': {
            'initialWh': float(initial_energy), 'terminalW': float(discharge),
            'durationS': float(dt), 'efficiency': float(eta),
            'finalWh': float(battery_wh), 'absoluteToleranceWh': 1e-8,
        },
        'rectangularPontoons': {
            'massKg': mass, 'densityKgM3': density, 'waterplaneM2': waterplane,
            'draftM': mass/(density*waterplane), 'freeboardM': 5-mass/(density*waterplane),
        },
        'airTransientRK4': {
            'initialK': 298.15, 'ambientK': 298.15, 'powerW': 100000,
            'conductanceWPerK': 22500, 'capacitanceJPerK': 12000000,
            'durationS': 120, 'stepS': 0.01, 'finalK': air_reference(),
            'absoluteToleranceK': 1e-7,
        },
    }
    path = Path(__file__).with_name('benchmarks.json')
    path.write_text(json.dumps(fixtures, indent=2, sort_keys=True)+'\n')
    print(f'Wrote {path.name}: 5 independent numerical benchmarks; empirical validation pending.')


if __name__ == '__main__':
    main()
