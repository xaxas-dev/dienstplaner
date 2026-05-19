# tarif_rules hat keine JVM-Abhängigkeit — immer importierbar.
from app.solver.tarif_rules import LOGISCH_HART, REGULATORISCH_HART, SOFT, ConstraintId

# JVM-abhängige Module: nur verfügbar wenn Java 17+ installiert.
# try/except stellt sicher, dass `import app.solver.anything` auch ohne JVM
# funktioniert (Phase-A-Invariante: Phase A startet unabhängig von JVM).
try:
    from app.solver.constraints import constraint_definitions
    from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift
    from app.solver.mapping import to_solver
except Exception:
    pass

__all__ = [
    "ConstraintId",
    "LOGISCH_HART",
    "REGULATORISCH_HART",
    "SOFT",
    "ShiftSchedule",
    "SolverDoctor",
    "SolverShift",
    "to_solver",
    "constraint_definitions",
]
