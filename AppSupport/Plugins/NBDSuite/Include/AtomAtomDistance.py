import numpy as np
import glob
import os
import argparse
import joblib
import mdtraj as md
import pandas as pd


def parseArguments():
    """
    Parse the command-line options
    :returns: str, int, int --  path to file to results folder,
        index of the first atom,
        index of the second atom
    """
    desc = "It includes the atom-atom distance of the specified ones to report files\n"
    parser = argparse.ArgumentParser(description=desc)
    required_named = parser.add_argument_group("required named arguments")
    required_named.add_argument(
        "sim_folder", type=str, help="Path to the simulation results."
    )

    required_named.add_argument(
        "-a",
        "--atoms",
        type=str,
        nargs="+",
        action="append",
        help="List of pairs of atoms to compute the distance between them.",
    )
    parser.add_argument(
        "-t", "--traj", default="trajectory_", help="Trajectory file prefix."
    )
    parser.add_argument("-r", "--rep", default="report_", help="Report file prefix.")
    parser.add_argument(
        "-p",
        "--proc",
        type=int,
        default=4,
        help="Number of processors to paralellize the computation.",
    )
    args = parser.parse_args()
    return args.sim_folder, args.atoms, args.traj, args.rep, args.proc


def compute_atom_atom_dist(infile, atoms_list):
    distances = []
    names = []
    traj = md.load_pdb(infile)
    atom_pairs = []
    for at_pair in atoms_list:
        for atom in at_pair:
            info = tuple(atom.split(":"))
            sel_label = "resname '%s' and residue %s and name %s" % info
            print(sel_label)
            atom = traj.top.select(sel_label)
            if atom.size == 0:
                raise ValueError("Nothing found under current selection")
            atom_pairs.append(atom.tolist())
        atom_pairs = [atom_pairs[0] + atom_pairs[1]]
        atom_pairs = np.array(atom_pairs)
        name = "{}-{}".format(at_pair[0], at_pair[1])
        distance = md.compute_distances(traj, atom_pairs)
        distances.append(distance)
        names.append(name)
    return distances, names


def compute_distances_from_report(atomlist, report, trajectory):
    distances, colnames = compute_atom_atom_dist(trajectory, atomlist)
    new_lines = []
    with open(report) as rep:
        rep_lines = rep.readlines()
        rep_lines = [x.strip("\n") for x in rep_lines]
        for ind, line in enumerate(rep_lines):
            new_content = list(line.split("    "))
            if new_content[-1] == "":
                new_content = new_content[:-1]
            if ind == 0:
                for colname in colnames:
                    new_content.append(colname)
            else:
                for dist in distances:
                    value = "{:.3f}".format(dist[ind - 1][0] * 10)
                    new_content.append(value)
            new_line = "    ".join(new_content)
            new_lines.append(new_line)
    new_report = "    \n".join(new_lines)
    new_report = new_report + "    \n"  # Adding the spacer in the last line
    new_rep_name = report.split("/")
    new_rep_name[-1] = "dist" + new_rep_name[-1]
    new_rep_name = "/".join(new_rep_name)
    with open(new_rep_name, "w") as out:
        out.write(new_report)
    print("{} completed".format(new_rep_name))


def compute_simulation_distance(
    sim_folder: str,
    atomlist,
    traj_pref="trajectory_",
    report_pref="report_",
    processors=4,
):
    """
    Computes the atom-atom distance for the specified atoms in the trajectory

    :param sim_folder: Path to the simulation results

    :param atomlist: List of pairs of atoms to compute the distance between them
    """
    trajectories = sorted(glob.glob("{}*".format(os.path.join(sim_folder, traj_pref))))
    reports = sorted(glob.glob("{}*".format(os.path.join(sim_folder, report_pref))))
    joblib.Parallel(n_jobs=processors)(
        joblib.delayed(compute_distances_from_report)(atomlist, report, traj)
        for report, traj in zip(reports, trajectories)
    )


if __name__ == "__main__":
    sim_fold, atom_list, traj, report, processors = parseArguments()
    compute_simulation_distance(sim_fold, atom_list, traj, report, processors)
