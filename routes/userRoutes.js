const express = require("express");
const router = express.Router();
const User = require("./../models/user");
const { generateToken, jwtAuthMiddleware } = require("../jwt");
const { parse } = require("json2csv"); // Correct import
const PDFDocument = require("pdfkit"); // Import PDFKit
const fs = require("fs");
const Candidate = require('../models/Candidate');

//Signup Route
router.post("/signup", async (req, res) => {
  try {
    const data = req.body; // Assuming the request body contains the User data

    // Create a new User document using the Mongoose model
    const newUser = new User(data);

    // save the new user to database
    const response = await newUser.save();
    console.log("data saved");

    const payload = {
      id: response.id,
    };
    console.log(JSON.stringify(payload));
    const token = generateToken(payload);
    console.log("token is : ", token);

    res.status(200).json({ response: response, token: token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//Login Route
router.post("/login", async (req, res) => {
  try {
    //extract aadharCardNumber and password from request body
    const { aadharCardNumber, password } = req.body;

    //find the user by aadharCardNumber
    const user = await User.findOne({ aadharCardNumber: aadharCardNumber });

    // If user does not exist or password does not match, return error
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ error: "Invalid Aadhar Card Number or Password" });
    }
    //generate Token
    const payload = {
      id: user.id,
    };
    const token = generateToken(payload);

    // return token as response
    console.log("user is logged in");
    res.json({ token });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//profile Route
router.get("/profile", jwtAuthMiddleware, async (req, res) => {
  try {
    const userData = req.user;
    const userId = userData.id;
    const user = await User.findById(userId);
    res.status(200).json({ user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//update password Route
router.put("/profile/password", jwtAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user; //extract the id from the token
    const { currentPassword, newPassword } = req.body; // Extract current and new passwords from request body

    //find the user by userId
    const user = await User.findById({ userId: userId });

    // If password does not match, return error
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: "Invalid Username or Password" });
    }

    //update the password
    user.password = newPassword;
    await user.save();

    console.log("Password updates");
    res.status(200).json({ message: "password uppdated" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to Get All Users in CSV Format
router.get("/export/csv", jwtAuthMiddleware, async (req, res) => {
  try {
    // Check if the user has admin role
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "User does not have admin role" });
    }

    // Fetch all user data
    const users = await User.find().select("-password"); // Exclude password from the exported data

    // Define the fields for CSV (each field will be a column)
    const fields = [
      "name",
      "age",
      "email",
      "mobile",
      "address",
      "aadharCardNumber",
      "role",
      "isVoted",
    ];

    // Convert JSON to CSV format
    const opts = { fields }; // Define options for json2csv
    const csv = parse(users, opts); // Use parse function here with fields

    // Set response headers for CSV file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");

    // Send the CSV data
    res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Route to Convert JSON to pdf format
router.get("/export/pdf", jwtAuthMiddleware, async (req, res) => {
  try {
    // Check if the user has admin role
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "User does not have admin role" });
    }

    // Fetch all user data
    const users = await User.find().select("-password");

    // Create a new PDF document
    const doc = new PDFDocument({
      margin: 30,
      size: "A4",
      layout: "landscape",
    });
    const filePath = "./users.pdf";
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Define table headers and their widths (with custom column widths)
    const headers = [
      { label: "Name", property: "name", width: 0.15 },
      { label: "Age", property: "age", width: 0.05 },
      { label: "Email", property: "email", width: 0.2 },
      { label: "Mobile", property: "mobile", width: 0.1 },
      { label: "Address", property: "address", width: 0.25 },
      { label: "Aadhar Card", property: "aadharCardNumber", width: 0.12 },
      { label: "Role", property: "role", width: 0.08 },
      { label: "Voted", property: "isVoted", width: 0.05 },
    ];

    // Calculate absolute column widths
    const pageWidth = doc.page.width - 2 * doc.page.margins.left;
    const columnWidths = headers.map((header) => pageWidth * header.width);

    // Add title
    doc
      .fontSize(20)
      .fillColor("#4CAF50")
      .text("User Data Report", { align: "center" })
      .moveDown(1);

    // Helper function to measure text height
    const measureTextHeight = (text, width, fontSize) => {
      if (!text) return fontSize + 10; // minimum height for empty cells
      const words = String(text).split(" ");
      let line = "";
      let height = fontSize + 10; // initial height with padding

      words.forEach((word) => {
        const testLine = line + word + " ";
        const testWidth = doc.fontSize(fontSize).widthOfString(testLine);

        if (testWidth > width - 10) {
          line = word + " ";
          height += fontSize + 2; // line height plus small gap
        } else {
          line = testLine;
        }
      });

      return height;
    };

    // Table helper functions
    const drawTableGrid = (startX, startY, rowHeight, columnXCoordinates) => {
      // Draw vertical lines
      columnXCoordinates.forEach((x) => {
        doc
          .strokeColor("#000000")
          .moveTo(x, startY)
          .lineTo(x, startY + rowHeight)
          .stroke();
      });

      // Draw final vertical line
      doc
        .strokeColor("#000000")
        .moveTo(startX + pageWidth, startY)
        .lineTo(startX + pageWidth, startY + rowHeight)
        .stroke();

      // Draw horizontal lines
      doc
        .strokeColor("#000000")
        .moveTo(startX, startY)
        .lineTo(startX + pageWidth, startY)
        .stroke()
        .moveTo(startX, startY + rowHeight)
        .lineTo(startX + pageWidth, startY + rowHeight)
        .stroke();
    };

    const createTable = () => {
      let x = doc.page.margins.left;
      let y = doc.y;
      const headerHeight = 30;

      // Draw header background
      doc.fillColor("#f5f5f5").rect(x, y, pageWidth, headerHeight).fill();

      // Calculate X coordinates for columns
      let xOffset = x;
      const columnXCoordinates = columnWidths.map((width) => {
        const currentX = xOffset;
        xOffset += width;
        return currentX;
      });

      // Draw header text
      doc.fillColor("#2196F3");
      headers.forEach((header, i) => {
        doc.fontSize(10).text(header.label, columnXCoordinates[i] + 5, y + 10, {
          width: columnWidths[i] - 10,
          align: "left",
        });
      });

      // Draw header grid lines
      drawTableGrid(x, y, headerHeight, columnXCoordinates);

      // Move position for data rows
      return { y: y + headerHeight, columnXCoordinates };
    };

    const createRow = (user, startY, columnXCoordinates) => {
      let x = doc.page.margins.left;

      // Calculate row height based on content
      const rowHeights = headers.map((header, i) => {
        const content =
          header.property === "isVoted"
            ? user[header.property]
              ? "Yes"
              : "No"
            : user[header.property];
        return measureTextHeight(content, columnWidths[i], 9);
      });

      const rowHeight = Math.max(...rowHeights);

      // Check if we need a new page
      if (startY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        const newTableStart = createTable();
        return createRow(
          user,
          newTableStart.y,
          newTableStart.columnXCoordinates
        );
      }

      // Draw row background
      doc.fillColor("#ffffff").rect(x, startY, pageWidth, rowHeight).fill();

      // Draw cell data
      doc.fillColor("#616161");
      headers.forEach((header, i) => {
        let value = user[header.property];
        if (header.property === "isVoted") {
          value = value ? "Yes" : "No";
        }

        doc
          .fontSize(9)
          .text(String(value), columnXCoordinates[i] + 5, startY + 5, {
            width: columnWidths[i] - 10,
            align: "left",
            lineBreak: true,
          });
      });

      // Draw grid lines for this row
      drawTableGrid(x, startY, rowHeight, columnXCoordinates);

      return startY + rowHeight;
    };

    // Create initial table headers
    const { y: startY, columnXCoordinates } = createTable();
    let currentY = startY;

    // Add data rows
    users.forEach((user, index) => {
      currentY = createRow(user, currentY, columnXCoordinates);
    });

    // Finalize the PDF
    doc.end();

    // When the PDF is fully written to the stream
    stream.on("finish", () => {
      // Set response headers for PDF file
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=users.pdf");

      // Send the generated PDF as response
      res.download(filePath, "users.pdf", (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Internal Server Error" });
        } else {
          console.log("PDF downloaded");
          // Delete the file after sending it
          fs.unlinkSync(filePath);
        }
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Route to Get aggregated data of candidates and voters
router.get("/candidates-with-voters", jwtAuthMiddleware, async (req, res) => {t
  try {
    const data = await Candidate.aggregate([
      {
        // Join User collection with Candidate's 'votes.user' field
        $lookup: {
          from: "users", // MongoDB collection name for User
          localField: "votes.user",
          foreignField: "_id",
          as: "voters"
        }
      },
      {
        // Project the required fields from both Candidate and User documents
        $project: {
          _id: 1,
          name: 1,
          party: 1,
          age: 1,
          voteCount: 1,
          voters: {
            name: 1,
            age: 1,
            email: 1,
            mobile: 1,
            address: 1,
            aadharCardNumber: 1,
            role: 1,
            isVoted: 1
          }
        }
      }
    ]);

    res.status(200).json({ data });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
