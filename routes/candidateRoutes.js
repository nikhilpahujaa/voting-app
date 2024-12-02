const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Import mongoose
const User = require('../models/user');
const { jwtAuthMiddleware, generateToken } = require('../jwt');
const Candidate = require('../models/candidate');

// Function to check if the user has admin role
const checkAdminRole = async (userID) => {
    try {
        const user = await User.findById(userID);
        return user && user.role === 'admin'; // Return true if user is found and has admin role
     } catch (err) {
        return false; // If any error occurs, return false
    }
};

// POST route to add a candidate
router.post('/', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id)))
            return res.status(403).json({ message: 'User does not have admin role' });

        const data = req.body; // Assuming the request body contains the candidate data

        // Create a new Candidate document using the Mongoose model
        const newCandidate = new Candidate(data);

        // Save the new candidate to the database
        const response = await newCandidate.save();
        console.log('Data saved');
        res.status(200).json({ response: response });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT route to update a candidate
router.put('/:candidateID', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id))) // Ensure the user has admin role
            return res.status(403).json({ message: 'User does not have admin role' });

        const candidateID = req.params.candidateID; // Extract the id from the URL parameter
        const updatedCandidateData = req.body; // Updated data for the candidate

        const response = await Candidate.findByIdAndUpdate(candidateID, updatedCandidateData, {
            new: true, // Return the updated document
            runValidators: true, // Run Mongoose validation
        });

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        console.log('Candidate data updated');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE route to remove a candidate
router.delete('/:candidateID', jwtAuthMiddleware, async (req, res) => {
    try {
        if (!(await checkAdminRole(req.user.id))) // Ensure the user has admin role
            return res.status(403).json({ message: 'User does not have admin role' });

        const candidateID = req.params.candidateID; // Extract the id from the URL parameter

        const response = await Candidate.findByIdAndDelete(candidateID);

        if (!response) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        console.log('Candidate deleted');
        res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route for users to vote
router.post('/vote/:candidateID', jwtAuthMiddleware, async (req, res) => {
    const { candidateID } = req.params; // Extract candidateID from URL parameters
    const userId = req.user.id; // Assuming user ID is part of the JWT payload

    try {
        // Check if candidateID is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(candidateID)) {
            return res.status(400).json({ message: 'Invalid candidate ID' });
        }

        // Find the Candidate document with the specified candidateID
        const candidate = await Candidate.findById(candidateID);
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Admin is not allowed to vote' });
        }

        if (user.isVoted) {
            return res.status(400).json({ message: 'You have already voted' });
        }

        // Update the Candidate document to record the vote
        candidate.votes.push({ user: userId });
        candidate.voteCount++;
        await candidate.save();

        // Update the user document
        user.isVoted = true;
        await user.save();

        return res.status(200).json({ message: 'Vote recorded successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// vote counts
router.get('/vote/record', async (req, res) => {
    console.log("Vote count route accessed");
    try {

        // Find all candidates and sort them by voteCount in descending order
        const candidates = await Candidate.find().sort({ voteCount: 'desc' });


        // Map the candidates to only return their name and voteCount
        const formattedVotes = candidates.map(candidate => ({
            party: candidate.party,
            count: candidate.voteCount
        }));

        return res.status(200).json(formattedVotes);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get List of all candidates with only name and party fields
router.get('/', async (req, res) => {
    try {
        // Find all candidates and select only the name and party fields, excluding _id
        const candidates = await Candidate.find({}, 'name party -_id');

        // Return the list of candidates
        res.status(200).json(candidates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




module.exports = router;
