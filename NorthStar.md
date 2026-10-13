# Why ? 

Products come with instructions. Said booklets are lost very easily. This project solves this problem by generating QR codes from the text in a booklet, and printing them on a 3D printer. Or it points to an online repository or a readme or something that has the instruction which are needed. Finally the printed QR code can be attached to the object as a label or if 3d printed as a key ring or something.

# What ?

So given this premise, what are we building? 
A dual interface which has some text box to generate the qr code. The other thing is to generate the 3d printed version. This is the MVP. But to make it useable and usable for a wider audience I would like to add more features such as:
- The 2D and 3D generated things should be able to have some way of creating text and labels. Like there should be a unified way of generating some text underneath the QR code and if we want a border around the QR code. 
- The same logic in 3D which is that we generate the 3D model but we have a few more variables to tweak so that we can create a lip around the QR code etc. in 99% of the cases a user is going to print it and then fill the gaps with nailpolish or something to get the consistent Look of a qr code that is durable.