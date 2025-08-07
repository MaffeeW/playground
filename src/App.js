import React, { useState, useEffect, useCallback } from 'react';
import './index.css'; // Make sure this line exists to import your CSS

// Main App component for the Bill Splitting application
function App() {
  // State to hold the raw text input of the bill
  const [billText, setBillText] = useState('');
  // State to store all parsed bill items: { id, name, price }
  const [billItems, setBillItems] = useState([]);
  // State to manage people involved in the split: { id, name }
  const [people, setPeople] = useState([{ id: 'person-1', name: 'Person 1' }]);
  // State to track assignments: { itemId: [personId1, personId2, ...] }
  // Each item maps to an array of person IDs responsible for it.
  const [assignments, setAssignments] = useState({});
  // State to store calculated totals for each person: { personId: totalAmount }
  const [totals, setTotals] = useState({});
  // State for any messages or errors to the user
  const [message, setMessage] = useState('');
  // State for tax and service charge percentages - Default values set to 9 and 10
  const [taxPercentage, setTaxPercentage] = useState(9); // Default tax to 9%
  const [serviceChargePercentage, setServiceChargePercentage] = useState(10); // Default service charge to 10%

  // Function to generate a unique ID for items or people
  const generateUniqueId = () => `id-${Math.random().toString(36).substring(2, 9)}`;

  // Handles changes to the bill text input
  const handleBillTextChange = (e) => {
    setBillText(e.target.value);
  };

  // Processes the bill text to parse items and initialize assignments
  const processBill = () => {
    setMessage(''); // Clear previous messages
    if (!billText.trim()) {
      setMessage('Please enter bill details.');
      return;
    }

    const lines = billText.split('\n').filter(line => line.trim() !== '');
    const newBillItems = [];
    let parsingError = false;

    // Regex to match an item name (can contain spaces), a number, and an optional dollar sign/currency symbol
    const itemRegex = /^(.*?)\s+([\d.]+)\s*$/;

    lines.forEach(line => {
      const match = line.match(itemRegex);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2]);
        if (!isNaN(price)) {
          newBillItems.push({ id: generateUniqueId(), name, price });
        } else {
          parsingError = true;
        }
      } else {
        parsingError = true;
      }
    });

    if (parsingError) {
      setMessage('Some lines could not be parsed. Please use format: "Item Name Price" (e.g., "Burger 12.50").');
    }

    setBillItems(newBillItems);

    // Initialize assignments: each new item starts with no one assigned
    const initialAssignments = {};
    newBillItems.forEach(item => {
      initialAssignments[item.id] = [];
    });
    setAssignments(initialAssignments);
  };

  // Adds a new person to the split
  const addPerson = () => {
    const newPersonId = generateUniqueId();
    const newPerson = { id: newPersonId, name: `Person ${people.length + 1}` };
    setPeople([...people, newPerson]);
  };

  // Handles changing a person's name
  const handlePersonNameChange = (id, newName) => {
    setPeople(prevPeople =>
      prevPeople.map(person =>
        person.id === id ? { ...person, name: newName } : person
      )
    );
  };

  // Removes a person from the split
  const removePerson = (idToRemove) => {
    // Only remove if there's more than one person
    if (people.length <= 1) {
      setMessage('Cannot remove the last person.');
      return;
    }

    setPeople(prevPeople => {
      const updatedPeople = prevPeople.filter(p => p.id !== idToRemove);

      // Update assignments: remove the person from all item assignments
      setAssignments(prevAssignments => {
        const newAssignments = { ...prevAssignments };
        for (const itemId in newAssignments) {
          newAssignments[itemId] = newAssignments[itemId].filter(personId => personId !== idToRemove);
        }
        return newAssignments;
      });
      return updatedPeople;
    });
  };

  // Toggles the assignment of an item to a specific person
  const toggleAssignment = (itemId, personId) => {
    setAssignments(prevAssignments => {
      const currentAssignees = prevAssignments[itemId] || [];
      const isAssigned = currentAssignees.includes(personId);

      let newAssignees;
      if (isAssigned) {
        // If already assigned, unassign them
        newAssignees = currentAssignments.filter(id => id !== personId);
      } else {
        // If not assigned, assign them
        newAssignees = [...currentAssignees, personId];
      }
      return {
        ...prevAssignments,
        [itemId]: newAssignees,
      };
    });
  };


  // Calculates the totals for each person based on assignments, service charge first, then tax
  const calculateTotals = useCallback(() => {
    const newTotals = people.reduce((acc, person) => ({ ...acc, [person.id]: 0 }), {});
    let totalBillAmountBeforeExtras = 0; // Sum of all item prices

    // Calculate subtotal for each person from their assigned items
    const personItemSubtotals = people.reduce((acc, person) => {
      acc[person.id] = 0;
      return acc;
    }, {});

    billItems.forEach(item => {
      totalBillAmountBeforeExtras += item.price;
      const assignees = assignments[item.id] || [];
      if (assignees.length > 0) {
        const share = item.price / assignees.length;
        assignees.forEach(personId => {
          personItemSubtotals[personId] = (personItemSubtotals[personId] || 0) + share;
        });
      }
    });

    // UPDATED CALCULATION SEQUENCE: Service Charge first, then Tax
    
    // Step 1: Calculate and add service charge to subtotal
    const totalServiceChargeAmount = totalBillAmountBeforeExtras * (serviceChargePercentage / 100);
    const serviceChargePerPerson = people.length > 0 ? totalServiceChargeAmount / people.length : 0;
    
    // Step 2: Calculate subtotal + service charge for each person
    const personSubtotalWithService = people.reduce((acc, person) => {
      acc[person.id] = (personItemSubtotals[person.id] || 0) + serviceChargePerPerson;
      return acc;
    }, {});
    
    // Step 3: Calculate total after service charge (for tax calculation base)
    const totalAfterServiceCharge = totalBillAmountBeforeExtras + totalServiceChargeAmount;
    
    // Step 4: Calculate tax on the total that includes service charge
    const totalTaxAmount = totalAfterServiceCharge * (taxPercentage / 100);
    
    // Step 5: Distribute tax proportionally based on each person's subtotal + service charge
    const totalAssignedValueWithService = Object.values(personSubtotalWithService).reduce((sum, val) => sum + val, 0);

    people.forEach(person => {
      let personTotal = personSubtotalWithService[person.id] || 0;

      // Add proportional tax based on their subtotal + service charge
      const taxShare = totalAssignedValueWithService > 0
        ? totalTaxAmount * (personTotal / totalAssignedValueWithService)
        : (people.length > 0 ? totalTaxAmount / people.length : 0); // If no items assigned, split tax equally
      
      personTotal += taxShare;
      newTotals[person.id] = personTotal;
    });

    setTotals(newTotals);
  }, [billItems, people, assignments, taxPercentage, serviceChargePercentage]);

  // Effect hook to recalculate totals whenever relevant states change
  useEffect(() => {
    calculateTotals();
  }, [assignments, calculateTotals]);

  // Handle changes to tax and service charge percentages
  const handleTaxChange = (e) => {
    const value = parseFloat(e.target.value);
    setTaxPercentage(isNaN(value) ? 0 : value);
  };

  const handleServiceChargeChange = (e) => {
    const value = parseFloat(e.target.value);
    setServiceChargePercentage(isNaN(value) ? 0 : value);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
      <div className="app-container">
        <h1>Bill Splitter</h1>
        <p>Enter your bill items below first, then click Process Bill.</p>

        {message && (
          <div className="message-alert" role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}

        {/* Two-Column Top Section: Bill Input and Additional Charges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Bill Input Section (Left Column) */}
          <div className="section-container">
            <label htmlFor="bill-text" className="block text-gray-700 text-sm font-bold mb-2">
              Bill Details
            </label>
            <textarea
              id="bill-text"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              rows="6"
              placeholder="E.g.,&#10;Burger 12.50&#10;Fries 4.00&#10;Drink 3.50"
              value={billText}
              onChange={handleBillTextChange}
            ></textarea>
            <button
              onClick={processBill}
              className="mt-4 w-full button blue-gradient"
            >
              Process Bill
            </button>
          </div>

          {/* Additional Charges (Right Column) */}
          <div className="section-container">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Additional Charges</h3>
            <div className="flex flex-col gap-4">
              {/* Service Charge first in UI to match calculation sequence */}
              <div className="flex-1">
                <label htmlFor="service-charge-percentage" className="block text-gray-700 text-sm font-bold mb-2">
                  Service Charge (%)
                </label>
                <input
                  type="number"
                  id="service-charge-percentage"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  value={serviceChargePercentage}
                  onChange={handleServiceChargeChange}
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
              {/* Tax second in UI to match calculation sequence */}
              <div className="flex-1">
                <label htmlFor="tax-percentage" className="block text-gray-700 text-sm font-bold mb-2">
                  Tax (%)
                </label>
                <input
                  type="number"
                  id="tax-percentage"
                  className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                  value={taxPercentage}
                  onChange={handleTaxChange}
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* People Management Section */}
        <div className="section-container">
          <h3>Who's Splitting?</h3>
          <p className="text-gray-600 text-sm mb-3 text-center">
            You can add or remove people here. Change a person's name by clicking on their text if needed.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {people.map(person => (
              <div key={person.id} className="person-tag">
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => handlePersonNameChange(person.id, e.target.value)}
                  className="bg-transparent border-none outline-none text-blue-800"
                  style={{ width: `${(person.name.length * 8) + 20}px` }} // Adjust width dynamically
                />
                <button
                  onClick={() => removePerson(person.id)}
                  className="ml-2 text-blue-600 hover:text-blue-900 focus:outline-none"
                  aria-label={`Remove ${person.name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addPerson}
            className="w-full button green-gradient"
          >
            Add Person
          </button>
        </div>

        {/* Item-Centric Assignment Area */}
        {billItems.length > 0 && (
          <div className="section-container">
            <h3>Assign Items</h3>
            <p className="text-gray-600 text-sm mb-3 text-center">
              Tap on names below each item to assign them. You can assign multiple people to one item, and its cost will be split evenly among them.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {billItems.map(item => (
                <div key={item.id} className="item-card">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-lg text-gray-700">{item.name}</span>
                    <span className="text-xl font-bold text-blue-700">${item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {people.map(person => {
                      const isAssigned = assignments[item.id]?.includes(person.id);
                      return (
                        <button
                          key={person.id}
                          onClick={() => toggleAssignment(item.id, person.id)}
                          className={`item-assign-button ${isAssigned ? 'assigned' : 'unassigned'}`}
                        >
                          {person.name}
                        </button>
                      );
                    })}
                    {/* Display if item is unassigned */}
                    {(assignments[item.id]?.length === 0 && people.length > 0) && (
                      <span className="text-red-500 text-sm italic ml-2">Unassigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals Section */}
        {Object.keys(totals).length > 0 && (
          <div className="section-container bg-blue-50">
            <h3>Totals Per Person</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {people.map(person => (
                <div key={person.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                  <span className="font-semibold text-lg text-gray-700">{person.name}:</span>
                  <span className="text-xl font-bold text-blue-700">${(totals[person.id] || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
