import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import Stripe from "stripe";
import { config } from "dotenv";
config();


const stripe = new Stripe('sk_test_51Qd4D7DEMoPiDyYyue54KSJdaDEQvhXuqtbOxGlLYFYKj0FpggJ1gk6nLgrxXbjbaSBqaEoJ5uAQZStmxDjVPPUh00ewbmf2Z3', {
  apiVersion: '2024-12-18.acacia',
});

const app = express();
const AppPORT = process.env.AppPORT;


app.use(bodyParser.urlencoded({extended:false}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



//Function to activate the Database Connection, return the Connector
async function activateDB(){
    try{
      const conn = await mysql.createConnection({
        host: process.env.host,
        user: process.env.user,
        password: process.env.password,
        database: process.env.database,
        port: process.env.port,
      });
      console.log("Connection Etablished Successfully!");
      return conn;
  }
  catch(err){
    console.log("Error While Connecting to Db" + err.stack);
    throw err;
  }
}


//Route for loading the Home Page of Application
app.get('/', (req, res)=>{
  //Home page
  res.render("homePage.ejs")
});



//Route to Open the New Registration Page of the Student & fetching the Selection results
app.get('/register', async(req, res)=>{

  const conn = await activateDB();
  try{
    let result = await conn.query(`SELECT * FROM courses`);
    console.log(result[0]);
    res.render("registrationPage.ejs", {courses: result[0]});
  }
  catch(err){
    console.log("Error While Fetching courses " + err.stack);
    res.status(403).send("Unable to Connect to DB");
  }
});



//Saving the Data Entered to be Save in Db with Duplicacy Check
app.post('/submit' ,async (req, res)=>{
  console.log(req.body);
  let data = req.body;
  const conn = await activateDB();

  try{
    let duplicateData = await conn.query(`SELECT roll_no FROM students where aadhar_no = "${data.aadhar_no}" LIMIT 1`);
    if(duplicateData[0].length > 0){
      let [{roll_no}] = duplicateData[0];
      console.log(duplicateData);
      res.send(`<h1>Student with Same ID already exists with Roll NO. ${roll_no}</h1>`);
    }
    else{
        try{
          let result = await conn.query(`INSERT INTO students VALUES(${null}, "${data.f_name}", "${data.l_name}", "${data.dob}", "${data.father_name}", "${data.mother_name}", "${data.gender}", ${data.course}, "${data.contact_no}", "${data.email_add}", "${data.aadhar_no}", "${data.house_no}", "${data.street_add}" , "${data.city}", "${data.distt}", "${data.state}", "${data.country}", "${data.pin_code}", ${0})`);
          console.log(result);
          //res.send("Success");

          try{
            let result = await conn.query(`SELECT roll_no FROM students WHERE aadhar_no = ${data.aadhar_no}`);
            console.log(result[0][0].roll_no);
            res.send(`Registered Successfully with Roll Number ${result[0][0].roll_no}`);
          }
          catch(error){
            res.send(`Thank You for Registration, It's Taking Longer than Usual, Try after Some time.`)
          }
        }

        catch(err){
          res.status(500).send("Unable to register" + err.stack);
        }
    }
  }
  catch(err){
    res.status(500).send("Unable to Validate Details" + err.stack);
  }

});


//Route to open view page of the students
app.get('/viewstudents' , async(req,res)=>{
  const conn = await activateDB();
  try{
    let result = await conn.query(`SELECT course_id, course_name FROM courses`);
    console.log(result[0]);
    res.render('viewStudents.ejs', {courses: result[0]});
  }
  catch(err){
    console.log("Unable to load List of courses from the DB");
    res.status(404).send(`Unable to Perform operation at the Moment`);
  }
});





//Route to view the List of the Students

app.post('/getData', async(req,res)=>{

  const conn = await activateDB();
  //we need courses list also, so we have to fetch that also
  let courses = [];
    try{
      let result = await conn.query(`SELECT course_id, course_name FROM courses`);
      courses = result[0];
      console.log(`Assigned Successfully the courses value`);
    }
    catch(err){
      console.log("Unable to load List of courses from the DB");
    }
  //Main work start from here

  let parameter = req.body.sel_course;
  let qry;
  if(parameter === ''){
    qry = `SELECT * FROM students`;
  }
  else{
    qry = `SELECT * FROM students WHERE course_id = ${parameter}`;
  }


  try{
    let result = await conn.query(qry);
    //console.log(result[0]);
    res.render('viewStudents.ejs', {dataList : result[0], courses: courses});
  }
  catch(err){
    console.log('Unable to Fetch Data');
    res.redirect('/viewstudents');
  }
});


app.get('/paydues', (req,res)=>{
  res.render("payDues.ejs");
});


app.post('/clearDues', async(req,res)=>{
  let roll_no = Number(req.body.roll_no);
  console.log(roll_no);
  try{
    const conn = await activateDB();
    let query = `SELECT roll_no, first_name, last_name, dues FROM students WHERE roll_no = ${roll_no}`;
    let result = await conn.query(query);
    console.log(result[0]);
    console.log(result[0].length);
    if(result[0].length == 0){
      res.render('paydues', {msg: `Invalid Roll Number Enter. Please try again.`})
    }
    else{
      res.render('paydues', {details: result[0]}); //some error here
    }
  }
  catch(err){
    console.log(err.stack);
    res.status(404).send("Unable to Perform Action Now");
  }
});



app.post('/paynow', async(req, res)=>{
  let {amount, remarks, roll_no} = req.body;
  amount = amount * 100; //paisa to rs conersion
  
  try{

    const product = await stripe.products.create({
      name: remarks,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: 'inr',
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
    });

    //res.status(200).send({ url: paymentLink.url });
    res.redirect(paymentLink.url);
  }
  catch(error){
    console.error('Error creating payment link:', error.message);
    res.status(500).send({ error: 'Unable to create payment link' });
  }
});



//App Running on the Port
app.listen(AppPORT, ()=>{
  console.log(`Working on the PORT http://localhost:${AppPORT}`);
});
